-- FR-32: reusable, private uploads before a post exists. Bytes live in Storage.
-- Completion means transfer completed, NOT moderation approval (FR-90).
-- 10 MB here is 10,000,000 bytes, matching the API and browser policy.
create table public.image_uploads (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles(id) on delete cascade,
    bucket_id text not null default 'post-images',
    object_key text not null unique,
    original_name text not null,
    content_type text not null,
    size_bytes integer not null,
    width integer not null,
    height integer not null,
    created_at timestamptz not null default now(),
    uploaded_at timestamptz,
    deleted_at timestamptz,
    constraint image_uploads_bucket check (bucket_id = 'post-images'),
    constraint image_uploads_type check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
    constraint image_uploads_size check (size_bytes between 1 and 10000000),
    constraint image_uploads_dimensions check (width > 0 and height > 0),
    constraint image_uploads_name check (char_length(original_name) between 1 and 255),
    constraint image_uploads_owner_path check (split_part(object_key, '/', 1) = owner_id::text)
);

comment on column public.image_uploads.width is
    'Browser-measured pixels, not independently verified by server-side image decoding.';
comment on column public.image_uploads.height is
    'Browser-measured pixels. Aspect ratio is derived from width / height.';
comment on column public.image_uploads.uploaded_at is
    'Storage confirmed byte size and MIME metadata; not a moderation decision.';

create index image_uploads_owner_idx on public.image_uploads (owner_id, created_at desc, id desc)
    where deleted_at is null;

alter table public.image_uploads enable row level security;
grant select on public.image_uploads to authenticated;
-- Needed for the Storage policies below. The UI still reads records via FastAPI.
create policy image_uploads_read_own on public.image_uploads
    for select to authenticated
    using (owner_id = (select auth.uid()) and deleted_at is null);
-- No client INSERT/UPDATE/DELETE policy. FastAPI owns the upload lifecycle.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', false, 10000000,
        array['image/jpeg', 'image/png', 'image/webp']);

-- FastAPI first creates a record after FR-02/FR-96 checks. It then signs with
-- the caller's JWT, so Storage also enforces ownership. No service-role key.
create policy post_images_insert_reserved on storage.objects
    for insert to authenticated with check (
        bucket_id = 'post-images'
        and exists (
            select 1 from public.image_uploads u
            where u.object_key = storage.objects.name and u.bucket_id = storage.objects.bucket_id
              and u.owner_id = (select auth.uid()) and u.deleted_at is null
              and u.uploaded_at is null and u.created_at > now() - interval '2 hours'
        )
    );

create policy post_images_read_own on storage.objects
    for select to authenticated using (
        bucket_id = 'post-images'
        and exists (
            select 1 from public.image_uploads u
            where u.object_key = storage.objects.name and u.bucket_id = storage.objects.bucket_id
              and u.owner_id = (select auth.uid()) and u.deleted_at is null
        )
    );
-- No public reads or object replacement. Publication/ordered post_media links
-- and cleanup of abandoned uploads are separate future migrations/workflows.
