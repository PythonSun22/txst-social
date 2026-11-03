-- FR-70 now covers both space follows (public.follows) and one-way student
-- follows. This supersedes the original 20260910200000 decision that limited
-- the graph to spaces; keep the two relationship types in separate tables.
-- A composite key makes duplicate relationships impossible; the reverse index
-- supports listing followers without maintaining denormalized counters.
create table public.user_follows (
    follower_id uuid not null references public.profiles(id) on delete cascade,
    followed_id uuid not null references public.profiles(id) on delete cascade,
    followed_at timestamptz not null default now(),
    constraint user_follows_pkey primary key (follower_id, followed_id),
    constraint user_follows_no_self check (follower_id <> followed_id)
);

create index user_follows_followed_idx
    on public.user_follows (followed_id, followed_at desc, follower_id);

alter table public.user_follows enable row level security;

create policy user_follows_public_read on public.user_follows
    for select using (true);

create policy user_follows_insert_own on public.user_follows
    for insert with check (
        follower_id = (select auth.uid())
        and exists (
            select 1 from public.profiles p
             where p.id = (select auth.uid())
               and p.email_verified_at is not null
               and p.suspended_at is null
               and p.deleted_at is null
        )
        and exists (
            select 1 from public.profiles p
             where p.id = followed_id
               and p.suspended_at is null
               and p.deleted_at is null
        )
    );

create policy user_follows_delete_own on public.user_follows
    for delete using (follower_id = (select auth.uid()));
