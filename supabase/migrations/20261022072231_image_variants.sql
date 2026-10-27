-- FR-32/90–92: private source uploads -> trusted WebP variants -> screening.
-- Old originals remain available to their owner, but are not silently approved.
alter table public.image_uploads
    add column purpose text not null default 'post' check (purpose in ('post','avatar','banner')),
    add column processing_status text not null default 'pending'
        check (processing_status in ('pending','processing','ready','blocked','failed')),
    add column processing_attempts integer not null default 0 check (processing_attempts >= 0),
    add column processing_next_attempt_at timestamptz not null default now(),
    add column processing_claim uuid,
    add column processing_lease_until timestamptz,
    add column processing_error text,
    add column original_deleted_at timestamptz,
    add column original_cleanup_after timestamptz,
    add column original_cleanup_error text;

create index image_processing_queue_idx on public.image_uploads (created_at, id)
    where uploaded_at is not null and deleted_at is null
      and processing_status in ('pending','processing');
create index image_original_cleanup_idx on public.image_uploads (original_cleanup_after)
    where original_deleted_at is null and processing_status in ('ready','blocked');

create table public.image_variants (
    image_upload_id uuid not null references public.image_uploads(id) on delete cascade,
    name text not null check (name in ('preview','expanded','avatar_small','avatar_large','banner')),
    object_key text not null unique,
    width integer not null check (width > 0),
    height integer not null check (height > 0),
    size_bytes integer not null check (size_bytes between 1 and 10000000),
    content_type text not null default 'image/webp' check (content_type = 'image/webp'),
    primary key (image_upload_id, name)
);

-- Image verdicts have their own audit: post audits still screen title/body + media.
create table public.image_processing_checks (
    id uuid primary key default gen_random_uuid(),
    image_upload_id uuid not null references public.image_uploads(id) on delete cascade,
    attempt integer not null check (attempt > 0),
    decision text not null check (decision in ('allow','block')),
    model text not null,
    policy_version text not null,
    content_hash text not null,
    provider_result jsonb not null,
    created_at timestamptz not null default now()
);
alter table public.image_variants enable row level security;
alter table public.image_processing_checks enable row level security;
grant select on public.image_variants to anon, authenticated;

alter table public.profiles
    add column pending_profile_image_upload_id uuid references public.image_uploads(id) on delete set null,
    add column pending_banner_image_upload_id uuid references public.image_uploads(id) on delete set null;

-- Retain legacy profile selections as pending, not as approved published assets.
-- A source used in both roles becomes an avatar; its banner must be re-uploaded.
update public.image_uploads u set purpose = 'banner'
    where exists(select 1 from public.profiles p where p.banner_image_upload_id = u.id)
      and not exists(select 1 from public.post_media m where m.image_upload_id = u.id);
update public.image_uploads u set purpose = 'avatar'
    where exists(select 1 from public.profiles p where p.profile_image_upload_id = u.id)
      and not exists(select 1 from public.post_media m where m.image_upload_id = u.id);
update public.profiles p set
    pending_profile_image_upload_id = (select u.id from public.image_uploads u
        where u.id = p.profile_image_upload_id and u.purpose = 'avatar'),
    pending_banner_image_upload_id = (select u.id from public.image_uploads u
        where u.id = p.banner_image_upload_id and u.purpose = 'banner'),
    profile_image_upload_id = null, banner_image_upload_id = null,
    profile_image_url = null;

-- Existing public image posts must also complete the new asset pipeline and
-- re-screen title/body with generated media before they can be served again.
update public.posts set status = 'pending', moderation_attempts = 0,
    moderation_next_attempt_at = now(), moderation_claim = null,
    moderation_lease_until = null, moderation_exhausted_at = null,
    moderation_error = null
    where type = 'image' and status = 'approved' and deleted_at is null;

-- SECURITY DEFINER avoids depending on owner-only image_uploads RLS for public
-- post reads. Return only an access decision, with a fixed search path.
create function public.can_read_image_variant(key text) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.image_variants v
        join public.image_uploads u on u.id = v.image_upload_id
        where v.object_key = key and u.deleted_at is null and (
            u.owner_id = (select auth.uid()) or (
                u.processing_status = 'ready' and (exists (
                    select 1 from public.post_media m join public.posts p on p.id = m.post_id
                    join public.spaces s on s.id = p.space_id
                    where m.image_upload_id = u.id and p.status = 'approved'
                      and p.deleted_at is null and s.deleted_at is null
                ) or exists (
                    select 1 from public.profiles p where p.deleted_at is null and p.suspended_at is null
                      and (p.profile_image_upload_id = u.id or p.banner_image_upload_id = u.id)
                ))
            )
        )
    );
$$;
revoke all on function public.can_read_image_variant(text) from public;
grant execute on function public.can_read_image_variant(text) to anon, authenticated;

-- Originals never become public through legacy post_media.object_key references.
drop policy post_images_read_approved on storage.objects;
create policy post_images_read_approved on storage.objects for select to anon, authenticated using (
    bucket_id = 'post-images' and public.can_read_image_variant(name)
);
-- Only active, approved profile images are publicly readable; pending replacements
-- remain owner-only. This also permits small avatars beside public posts.
create policy image_variants_read_approved_post on public.image_variants for select using (
    public.can_read_image_variant(object_key)
);
-- No browser writes to variants/audits or UPDATE/DELETE on Storage objects.

create function public.check_profile_image_approval() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.profile_image_upload_id is not null and
       new.profile_image_upload_id is distinct from old.profile_image_upload_id and not exists (
        select 1 from public.image_uploads u where u.id = new.profile_image_upload_id
          and u.owner_id = new.id and u.purpose = 'avatar' and u.processing_status = 'ready'
          and u.deleted_at is null
    ) then raise exception 'Profile image must be an approved owned avatar (FR-90)'; end if;
    if new.banner_image_upload_id is not null and
       new.banner_image_upload_id is distinct from old.banner_image_upload_id and not exists (
        select 1 from public.image_uploads u where u.id = new.banner_image_upload_id
          and u.owner_id = new.id and u.purpose = 'banner' and u.processing_status = 'ready'
          and u.deleted_at is null
    ) then raise exception 'Banner must be an approved owned banner (FR-90)'; end if;
    return new;
end;
$$;
create trigger profiles_image_approval before update on public.profiles
    for each row execute function public.check_profile_image_approval();
