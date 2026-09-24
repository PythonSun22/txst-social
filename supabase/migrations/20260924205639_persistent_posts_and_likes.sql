-- FR-30/31/32: text, images, or text plus ordered images. Keep legacy link posts.
create table public.post_media (
    post_id uuid not null references public.posts(id) on delete cascade,
    position smallint not null check (position >= 0),
    image_upload_id uuid references public.image_uploads(id) on delete restrict,
    object_key text not null,
    width integer check (width > 0),
    height integer check (height > 0),
    primary key (post_id, position),
    unique (post_id, image_upload_id)
);
create index post_media_object_key_idx on public.post_media (object_key);
-- Nullable upload/dimensions preserve legacy image keys without inventing metadata.
insert into public.post_media (post_id, position, object_key)
select id, 0, image_key from public.posts where image_key is not null;

alter table public.posts drop constraint posts_body_matches_type;
alter table public.posts drop column image_key;
alter table public.posts add constraint posts_body_matches_type check (
    (type = 'text' and body is not null and url is null) or
    (type = 'image' and url is null) or
    (type = 'link' and url is not null and body is null)
);
-- Idempotent browser submissions survive a lost success response.
alter table public.posts add column submission_id uuid;
create unique index posts_submission_idx on public.posts (author_id, submission_id)
    where submission_id is not null;

-- Cross-table content checks run at commit, after all attachments are inserted.
create function public.check_post_media_content() returns trigger
language plpgsql set search_path = '' as $$
declare
    target uuid;
    targets uuid[];
    kind text;
    has_media boolean;
begin
    if tg_table_name = 'posts' then
        targets := array[new.id];
    elsif tg_op = 'DELETE' then
        targets := array[old.post_id];
    elsif tg_op = 'UPDATE' then
        targets := array[old.post_id, new.post_id];
    else
        targets := array[new.post_id];
    end if;
    foreach target in array targets loop
        select type::text into kind from public.posts where id = target;
        if found then
            select exists(select 1 from public.post_media where post_id = target) into has_media;
            if (kind = 'image') <> has_media then
                raise exception 'Image posts require media; text/link posts cannot have media (FR-31)'
                    using errcode = 'check_violation';
            end if;
        end if;
    end loop;
    return null;
end;
$$;
create constraint trigger posts_media_content after insert or update on public.posts
    deferrable initially deferred for each row execute function public.check_post_media_content();
create constraint trigger post_media_content after insert or update or delete on public.post_media
    deferrable initially deferred for each row execute function public.check_post_media_content();

alter table public.post_media enable row level security;
grant select on public.post_media to anon, authenticated;
create policy post_media_visible on public.post_media for select using (
    exists(select 1 from public.posts p join public.spaces s on s.id = p.space_id
        where p.id = post_id and p.deleted_at is null and s.deleted_at is null
        and (p.status = 'approved' or p.author_id = (select auth.uid())))
);
-- FR-90: approved attachments may be read through signed URLs, but the bucket
-- stays private. Pending uploads keep the original owner-only Storage policy.
create policy post_images_read_approved on storage.objects for select to anon, authenticated using (
    bucket_id = 'post-images' and exists (
        select 1 from public.post_media m join public.posts p on p.id = m.post_id
        join public.spaces s on s.id = p.space_id
        where m.object_key = storage.objects.name and p.status = 'approved'
          and p.deleted_at is null and s.deleted_at is null
    )
);

-- FR-50/51: post likes now go through FastAPI so counters, karma and stored
-- ranking are updated in the same transaction. No browser bypass of that path.
drop policy post_likes_insert_own on public.post_likes;
drop policy post_likes_delete_own on public.post_likes;
