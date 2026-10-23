-- FR-32/90–92: service failures must not destroy the only recoverable input.
alter table public.image_uploads add column recovery_required boolean not null default false;
update public.image_uploads set recovery_required=true, asset_cleanup_after=null
where uploaded_at is not null and processing_status in ('pending','processing','failed')
  and (processing_error is null or processing_error not in ('invalid_image','upload_expired','unused_image'));

create or replace function public.queue_terminal_image_cleanup() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.uploaded_at is not null and new.processing_status='failed'
       and (new.processing_error is null or new.processing_error not in ('invalid_image','upload_expired','unused_image')) then
        new.recovery_required := true;
    end if;
    if new.recovery_required and new.deleted_at is null then
        new.asset_cleanup_after := null;
    elsif new.processing_status in ('blocked','failed') then
        new.asset_cleanup_after := least(coalesce(new.asset_cleanup_after,clock_timestamp()+interval '5 minutes'),clock_timestamp()+interval '5 minutes');
    end if;
    return new;
end;
$$;

-- Also guard the BEFORE DELETE event used by Storage, including service-role
-- callers. Do not lock the upload here: the API worker holds that row lock while
-- calling Storage on a separate connection. Read the committed lifecycle state.
create function public.guard_image_source_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    upload record;
    expected integer;
    confirmed integer;
begin
    if old.bucket_id <> 'post-images' then return old; end if;
    select * into upload from public.image_uploads where bucket_id=old.bucket_id and object_key=old.name;
    if not found then return old; end if;
    -- Explicit owner abandonment/asset retirement is a deliberate deletion.
    if upload.deleted_at is not null then return old; end if;
    if upload.uploaded_at is null and upload.processing_status='failed' and
       upload.processing_error='upload_expired' then return old; end if;
    if upload.processing_status='failed' and upload.processing_error='invalid_image'
       and not upload.recovery_required then return old; end if;
    if upload.processing_status in ('ready','blocked') and not upload.recovery_required then
        expected := case upload.purpose when 'banner' then 1 else 2 end;
        select count(*) into confirmed from public.image_variants v
          join public.image_storage_objects o on o.object_key=v.object_key
          where v.image_upload_id=upload.id and o.confirmed_at is not null and o.deleted_at is null
            and ((upload.purpose='post' and v.name in ('preview','expanded'))
              or (upload.purpose='avatar' and v.name in ('avatar_small','avatar_large'))
              or (upload.purpose='banner' and v.name='banner'));
        if confirmed=expected then return old; end if;
    end if;
    raise exception 'Preserve image input until processing succeeds or owner abandons asset (FR-32)'
      using errcode='check_violation';
end;
$$;
revoke all on function public.guard_image_source_deletion() from public;
create trigger guard_image_source_deletion before delete on storage.objects
  for each row execute function public.guard_image_source_deletion();
