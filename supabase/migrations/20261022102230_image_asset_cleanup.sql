-- FR-32/34/90: hard-delete unused object bytes, retain metadata/audits/rate history.
alter table public.image_uploads
    add column asset_cleanup_after timestamptz default (now()+interval '24 hours'),
    add column asset_cleanup_attempts integer not null default 0 check (asset_cleanup_attempts >= 0),
    add column asset_cleanup_error text,
    add column files_deleted_at timestamptz;
create index image_asset_cleanup_idx on public.image_uploads(asset_cleanup_after, id)
    where files_deleted_at is null and asset_cleanup_after is not null;
alter table public.image_storage_objects
    add column cleanup_after timestamptz not null default (now()+interval '24 hours'),
    add column cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
    add column cleanup_error text;
create index image_orphan_cleanup_idx on public.image_storage_objects(cleanup_after)
    where deleted_at is null and image_upload_id is null;

-- Existing assets get at least one preview-URL lifetime before eligibility.
update public.image_uploads set asset_cleanup_after=greatest(created_at+interval '24 hours',now()+interval '5 minutes');

create function public.queue_image_cleanup(target uuid) returns void
language sql set search_path = '' as $$
    update public.image_uploads set asset_cleanup_after=least(
        coalesce(asset_cleanup_after,clock_timestamp()+interval '5 minutes'),clock_timestamp()+interval '5 minutes')
    where id=target and files_deleted_at is null;
$$;
revoke all on function public.queue_image_cleanup(uuid) from public;

create function public.guard_post_image_reference() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.image_upload_id is not null then
        perform 1 from public.image_uploads where id=new.image_upload_id
            and deleted_at is null and files_deleted_at is null for update;
        if not found then raise exception 'Image is no longer available (FR-32)' using errcode='check_violation'; end if;
    end if;
    -- Serialize the physical key too, including legacy key-only references.
    perform 1 from public.image_storage_objects where object_key=new.object_key and deleted_at is null for update;
    if not found and exists(select 1 from public.image_storage_objects where object_key=new.object_key) then
        raise exception 'Image file was removed (FR-32)' using errcode='check_violation';
    end if;
    return new;
end;
$$;
create trigger post_media_guard_image before insert or update of image_upload_id,object_key,post_id
    on public.post_media for each row execute function public.guard_post_image_reference();

create function public.track_post_image_reference() returns trigger
language plpgsql set search_path = '' as $$
begin
    if tg_op <> 'INSERT' then perform public.queue_image_cleanup(old.image_upload_id); end if;
    if tg_op <> 'DELETE' then
        if exists(select 1 from public.posts where id=new.post_id and deleted_at is null) then
            update public.image_uploads set asset_cleanup_after=null where id=new.image_upload_id and deleted_at is null;
        else perform public.queue_image_cleanup(new.image_upload_id); end if;
    end if;
    return null;
end;
$$;
create trigger post_media_track_image after insert or delete or update of image_upload_id,post_id
    on public.post_media for each row execute function public.track_post_image_reference();

create function public.track_post_image_deletion() returns trigger
language plpgsql set search_path = '' as $$
declare target uuid;
begin
    if new.deleted_at is distinct from old.deleted_at then
        for target in select image_upload_id from public.post_media where post_id=new.id and image_upload_id is not null order by image_upload_id loop
            if new.deleted_at is not null then perform public.queue_image_cleanup(target);
            else
                perform 1 from public.image_uploads where id=target and deleted_at is null and files_deleted_at is null for update;
                if not found then raise exception 'Post images were permanently removed (FR-34)' using errcode='check_violation'; end if;
                update public.image_uploads set asset_cleanup_after=null where id=target;
            end if;
        end loop;
    end if;
    return null;
end;
$$;
create trigger posts_track_image_deletion after update of deleted_at on public.posts
    for each row execute function public.track_post_image_deletion();

create function public.guard_profile_image_references() returns trigger
language plpgsql set search_path = '' as $$
declare target uuid;
begin
    for target in select distinct id from unnest(array[new.profile_image_upload_id,new.banner_image_upload_id,
        new.pending_profile_image_upload_id,new.pending_banner_image_upload_id]) id where id is not null order by id loop
        if (new.deleted_at is null and old.deleted_at is not null) or not (target=any(array[old.profile_image_upload_id,
            old.banner_image_upload_id,old.pending_profile_image_upload_id,old.pending_banner_image_upload_id]::uuid[]) is true) then
            perform 1 from public.image_uploads where id=target and owner_id=new.id and deleted_at is null and files_deleted_at is null for update;
            if not found then raise exception 'Profile image is no longer available (FR-32)' using errcode='check_violation'; end if;
        end if;
    end loop;
    return new;
end;
$$;
create trigger profiles_guard_image_references before update of profile_image_upload_id,banner_image_upload_id,
    pending_profile_image_upload_id,pending_banner_image_upload_id,deleted_at on public.profiles
    for each row execute function public.guard_profile_image_references();

create function public.track_profile_image_references() returns trigger
language plpgsql set search_path = '' as $$
declare target uuid;
begin
    for target in select distinct id from unnest(array[old.profile_image_upload_id,old.banner_image_upload_id,
        old.pending_profile_image_upload_id,old.pending_banner_image_upload_id]) id where id is not null order by id loop
        if new.deleted_at is not null or not (target=any(array[new.profile_image_upload_id,new.banner_image_upload_id,
            new.pending_profile_image_upload_id,new.pending_banner_image_upload_id]::uuid[]) is true) then
            perform public.queue_image_cleanup(target);
        end if;
    end loop;
    if new.deleted_at is null then
        update public.image_uploads set asset_cleanup_after=null where deleted_at is null and (
            id=any(array[new.profile_image_upload_id,new.banner_image_upload_id]::uuid[]) or
            (processing_status not in ('blocked','failed') and
             id=any(array[new.pending_profile_image_upload_id,new.pending_banner_image_upload_id]::uuid[])));
    end if;
    return null;
end;
$$;
create trigger profiles_track_image_references after update of profile_image_upload_id,banner_image_upload_id,
    pending_profile_image_upload_id,pending_banner_image_upload_id,deleted_at on public.profiles
    for each row execute function public.track_profile_image_references();

create function public.queue_terminal_image_cleanup() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.processing_status in ('blocked','failed') then
        new.asset_cleanup_after := least(coalesce(new.asset_cleanup_after,clock_timestamp()+interval '5 minutes'),clock_timestamp()+interval '5 minutes');
    end if;
    return new;
end;
$$;
create trigger image_terminal_cleanup before insert or update of processing_status on public.image_uploads
    for each row execute function public.queue_terminal_image_cleanup();
