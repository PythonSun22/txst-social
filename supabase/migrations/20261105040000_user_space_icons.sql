-- FR-20/21/24/32: user-created communities reuse approved square avatar assets.
alter table public.spaces add column icon_image_upload_id uuid
    references public.image_uploads(id) on delete set null;
alter table public.spaces add constraint spaces_community_route
    check (kind <> 'community' or slug <> 'create');
create index spaces_icon_image_idx on public.spaces(icon_image_upload_id)
    where icon_image_upload_id is not null;

-- Storage signs variants using the caller's token. Approved icons on active
-- spaces must be readable to other students and signed-out visitors too.
create or replace function public.can_read_image_variant(key text) returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.image_variants v
        join public.image_uploads u on u.id=v.image_upload_id
        where v.object_key=key and u.deleted_at is null and (
            u.owner_id=(select auth.uid()) or (
                u.processing_status='ready' and (exists (
                    select 1 from public.post_media m join public.posts p on p.id=m.post_id
                    join public.spaces s on s.id=p.space_id
                    where m.image_upload_id=u.id and p.status='approved'
                      and p.deleted_at is null and s.deleted_at is null
                ) or exists (
                    select 1 from public.profiles p where p.deleted_at is null and p.suspended_at is null
                      and (p.profile_image_upload_id=u.id or p.banner_image_upload_id=u.id)
                ) or exists (
                    select 1 from public.spaces s where s.deleted_at is null
                      and s.icon_image_upload_id=u.id and v.name in ('avatar_small','avatar_large')
                ))
            )
        )
    );
$$;
revoke all on function public.can_read_image_variant(text) from public;
grant execute on function public.can_read_image_variant(text) to anon, authenticated;

-- Match cleanup's account-before-upload lock order in the application. Never
-- attach retired, foreign, unfinished or rejected photos, even through SQL.
create function public.guard_space_icon() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.icon_image_upload_id is not null and new.deleted_at is null then
        perform 1 from public.image_uploads where id=new.icon_image_upload_id
            and owner_id=new.created_by and purpose='avatar' and uploaded_at is not null
            and processing_status='ready' and deleted_at is null and files_deleted_at is null
            for update;
        if not found then
            raise exception 'Choose your own approved space photo (FR-32)' using errcode='check_violation';
        end if;
    end if;
    return new;
end;
$$;
create trigger spaces_guard_icon before insert or update of icon_image_upload_id,created_by,deleted_at
    on public.spaces for each row execute function public.guard_space_icon();

create function public.track_space_icon() returns trigger
language plpgsql set search_path = '' as $$
begin
    if tg_op in ('UPDATE','DELETE') then
        if old.icon_image_upload_id is not null then
            perform public.queue_image_cleanup(old.icon_image_upload_id);
        end if;
    end if;
    if tg_op <> 'DELETE' and new.deleted_at is null and new.icon_image_upload_id is not null then
        update public.image_uploads set asset_cleanup_after=null where id=new.icon_image_upload_id;
    end if;
    return null;
end;
$$;
create trigger spaces_track_icon after insert or delete or update of icon_image_upload_id,deleted_at
    on public.spaces for each row execute function public.track_space_icon();
