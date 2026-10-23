-- FR-02/32/90/96: bounded authenticated transfers, without reusable upload URLs.
-- Preserve every existing signed capability and its existing accounting horizon.
alter table public.image_uploads
    add column upload_method text not null default 'signed'
        check (upload_method in ('signed', 'authenticated')),
    add column upload_expires_at timestamptz;
alter table public.image_uploads alter column upload_method set default 'authenticated';
alter table public.image_uploads add constraint authenticated_image_size
    check (upload_method <> 'authenticated' or size_bytes <= 2000000);
alter table public.image_uploads add constraint authenticated_image_deadline
    check (upload_method <> 'authenticated' or upload_expires_at is not null);

-- No rewrite of existing ledger sizes: old originals may still contain 10 MB.
update storage.buckets set file_size_limit=2000000 where id='post-images';

create or replace function public.initialize_image_storage_reservation() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.processing_status in ('pending','processing') and new.processing_reserved_bytes=0 then
        new.processing_reserved_bytes := case new.purpose
            when 'post' then 2000000 when 'avatar' then 250000 when 'banner' then 1000000 end;
    end if;
    if new.upload_method='authenticated' then
        new.upload_expires_at := coalesce(new.upload_expires_at, new.created_at+interval '15 minutes');
        new.original_cleanup_after := new.created_at;
    else
        new.original_cleanup_after := new.created_at+interval '7500 seconds';
    end if;
    return new;
end;
$$;

create or replace function public.track_image_original() returns trigger
language plpgsql set search_path = '' as $$
begin
    insert into public.image_storage_objects(object_key,owner_id,image_upload_id,kind,size_bytes,confirmed_at,deleted_at)
    values(new.object_key,new.owner_id,new.id,'original',
        case when new.uploaded_at is not null then new.size_bytes
             when new.upload_method='authenticated' then 2000000 else 10000000 end,
        new.uploaded_at,new.original_deleted_at);
    return null;
end;
$$;

-- This function exposes only a boolean for one owner-scoped reservation.
create function public.can_upload_reserved_image(bucket text, object_name text) returns boolean
language sql volatile security definer set search_path = '' as $$
    select exists (
        select 1 from public.image_uploads u join public.profiles p on p.id=u.owner_id
        where u.bucket_id=bucket and u.object_key=object_name
          and u.owner_id=(select auth.uid()) and u.upload_method='authenticated'
          and u.uploaded_at is null and u.deleted_at is null
          and u.original_deleted_at is null and u.files_deleted_at is null
          and u.processing_status='pending' and u.upload_expires_at>clock_timestamp()
          and p.email_verified_at is not null and p.deleted_at is null and p.suspended_at is null
    );
$$;
revoke all on function public.can_upload_reserved_image(text,text) from public;
grant execute on function public.can_upload_reserved_image(text,text) to authenticated;

drop policy post_images_insert_reserved on storage.objects;
create policy post_images_insert_reserved on storage.objects
    for insert to authenticated with check (
        bucket_id='post-images' and public.can_upload_reserved_image(bucket_id,name)
    );
-- There remains no client UPDATE or DELETE policy: upsert/copy/move cannot
-- replace an input after it has been validated. Variants remain worker-only.

-- Storage can check RLS before receiving bytes, then commit metadata later.
-- Fence the FINAL write too (even if Storage performs it as its internal role).
-- Serialize with completion/expiry/cleanup using the upload row lock. Failed
-- Storage writes are responsible for deleting their own uncommitted versions.
create function public.guard_authenticated_image_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    reservation record;
begin
    if new.bucket_id <> 'post-images' then return new; end if;
    select * into reservation from public.image_uploads
        where bucket_id=new.bucket_id and object_key=new.name for update;
    if not found or reservation.upload_method <> 'authenticated' then return new; end if;
    if tg_op <> 'INSERT' or reservation.uploaded_at is not null
       or reservation.deleted_at is not null or reservation.original_deleted_at is not null
       or reservation.files_deleted_at is not null or reservation.processing_status <> 'pending'
       or reservation.upload_expires_at <= clock_timestamp()
       or not exists (select 1 from public.profiles p where p.id=reservation.owner_id
           and p.email_verified_at is not null and p.deleted_at is null and p.suspended_at is null) then
        raise exception 'Image upload reservation is closed' using errcode='42501';
    end if;
    -- Permission probes may omit actual metadata. The committed object metadata
    -- and API completion both check actual bytes; bucket limits bound transfer.
    if new.metadata ? 'size' and
       ((new.metadata->>'size')::bigint <> reservation.size_bytes or
        new.metadata->>'mimetype' is distinct from reservation.content_type) then
        raise exception 'Image does not match its reservation' using errcode='23514';
    end if;
    return new;
end;
$$;
revoke all on function public.guard_authenticated_image_write() from public;
create trigger guard_authenticated_image_write before insert or update on storage.objects
    for each row execute function public.guard_authenticated_image_write();
