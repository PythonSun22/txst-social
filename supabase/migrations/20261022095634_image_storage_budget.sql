-- FR-32: account storage counts object bytes and held capacity, never post references.
alter table public.image_uploads add column processing_reserved_bytes bigint not null default 0
    check (processing_reserved_bytes >= 0);

create table public.image_storage_objects (
    object_key text primary key,
    owner_id uuid not null references public.profiles(id) on delete restrict,
    image_upload_id uuid references public.image_uploads(id) on delete restrict,
    kind text not null check (kind in ('original', 'variant', 'orphan')),
    size_bytes bigint not null check (size_bytes >= 0),
    covered_by_reservation boolean not null default false,
    attempt_claim uuid,
    confirmed_at timestamptz,
    deleted_at timestamptz,
    created_at timestamptz not null default now()
);
create index image_storage_owner_idx on public.image_storage_objects(owner_id) where deleted_at is null;
create index image_storage_upload_idx on public.image_storage_objects(image_upload_id);
alter table public.image_storage_objects enable row level security;
-- Backend accounting only; no browser policies or grants.

-- Existing sources/versions are charged once. Deleted-source metadata costs nothing.
-- The Storage inventory is authoritative for historical files. An unexpired
-- source capability still needs capacity even when its object does not exist yet.
update public.image_uploads u set original_deleted_at=now(),
    processing_status=case when processing_status in ('pending','processing') then 'failed' else processing_status end
where original_deleted_at is null and created_at <= now()-interval '7500 seconds'
    and not exists(select 1 from storage.objects s where s.bucket_id=u.bucket_id and s.name=u.object_key);
insert into public.image_storage_objects(object_key, owner_id, image_upload_id, kind, size_bytes, confirmed_at)
select u.object_key, u.owner_id, u.id, 'original',
    coalesce((s.metadata->>'size')::bigint, case when u.uploaded_at is not null then u.size_bytes else 10000000 end),
    case when u.uploaded_at is not null or s.name is not null then now() end
from public.image_uploads u left join storage.objects s on s.bucket_id=u.bucket_id and s.name=u.object_key
where u.original_deleted_at is null;
insert into public.image_storage_objects(object_key, owner_id, image_upload_id, kind, size_bytes, confirmed_at)
select v.object_key, u.owner_id, u.id, 'variant', coalesce((s.metadata->>'size')::bigint, v.size_bytes), now()
from public.image_variants v join public.image_uploads u on u.id=v.image_upload_id
join storage.objects s on s.bucket_id=u.bucket_id and s.name=v.object_key
on conflict do nothing;
-- Include pre-existing interrupted writes, even without a variant/upload reference.
insert into public.image_storage_objects(object_key, owner_id, kind, size_bytes, confirmed_at)
select s.name, p.id, 'orphan', coalesce((s.metadata->>'size')::bigint, 10000000), now()
from storage.objects s join public.profiles p on split_part(s.name, '/', 1)=p.id::text
where s.bucket_id='post-images' on conflict do nothing;
update public.image_uploads set processing_reserved_bytes = case purpose
    when 'post' then 2000000 when 'avatar' then 250000 when 'banner' then 1000000 end
where processing_status in ('pending', 'processing') and deleted_at is null;
update public.image_uploads set original_cleanup_after=created_at+interval '7500 seconds'
where original_deleted_at is null and original_cleanup_after is null;

-- Every new asset has a source-capacity record, including uncertain/failed transfers.
-- Signed URLs permit the bucket's full 10 MB, regardless of the browser's declared size.
create function public.initialize_image_storage_reservation() returns trigger
language plpgsql set search_path = '' as $$
begin
    -- API passes its checked headroom explicitly; defaults also cover legacy/test inserts.
    if new.processing_status in ('pending','processing') and new.processing_reserved_bytes=0 then
        new.processing_reserved_bytes := case new.purpose
            when 'post' then 2000000 when 'avatar' then 250000 when 'banner' then 1000000 end;
    end if;
    new.original_cleanup_after := new.created_at + interval '7500 seconds';
    return new;
end;
$$;
create trigger image_storage_reserve before insert on public.image_uploads
    for each row execute function public.initialize_image_storage_reservation();
create function public.track_image_original() returns trigger
language plpgsql set search_path = '' as $$
begin
    insert into public.image_storage_objects(object_key,owner_id,image_upload_id,kind,size_bytes,confirmed_at,deleted_at)
    values(new.object_key,new.owner_id,new.id,'original',
        case when new.uploaded_at is null then 10000000 else new.size_bytes end,
        new.uploaded_at,new.original_deleted_at);
    return null;
end;
$$;
create trigger image_storage_track_original after insert on public.image_uploads
    for each row execute function public.track_image_original();
