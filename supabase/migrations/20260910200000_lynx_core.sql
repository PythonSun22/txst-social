-- =========================================================================
-- TXST Lynx — core schema
--
-- Builds on 20260901212005_initial_schema.sql. That migration established two
-- things this one treats as settled:
--
--   1. Supabase Auth owns credentials. public.profiles is the application's
--      row for a person, keyed to auth.users(id). [D-1] is therefore CLOSED —
--      see the profiles section below.
--   2. Row Level Security is on. Every table added here enables it too, and
--      ships policies. A Supabase table with RLS on and no policy returns zero
--      rows to the API, which looks exactly like a broken query.
--
-- This file is the source of truth for the data model. backend/models.py
-- mirrors it by hand; when you change one, change the other in the same commit.
--
-- Settled with the team, 2026-09-10:
--   [D-1]  Supabase Auth owns identity. profiles.id = auth.users.id.
--   [D-2]  Spaces are ONE table with a `kind`, not three parallel tables.
--   FR-60  General is a destination of its own, not an aggregate of the rest.
--   FR-70  The social graph connects people to spaces only. Nobody follows a person.
--   FR-99  Reporting covers accounts as well as posts and comments.
--
-- Still open, each marked where it bites:
--   [D-3]  materialized path for the comment tree — implemented, not yet reviewed.
--   [D-4]  what happens when the classifier does not answer — UNDECIDED.
--   [D-5]  colleges vs. departments in the seed — UNDECIDED.
--
--
-- Conventions
--   * uuid primary keys, generated in the database.
--   * timestamptz everywhere. Never `timestamp` — it discards the offset and
--     the bug surfaces at the end of daylight saving time.
--   * Soft delete. Nothing is removed; deleted_at is set and every read index
--     carries WHERE deleted_at IS NULL so tombstones cost nothing.
--   * Counter columns are caches. Each must be written in the SAME TRANSACTION
--     as the row it summarizes.
-- =========================================================================


create extension if not exists citext;   -- case-insensitive slugs, usernames, emails
create extension if not exists ltree;    -- comment tree paths


-- -------------------------------------------------------------------------
-- profiles — extending what already exists
-- -------------------------------------------------------------------------
-- [D-1] CLOSED. The previous migration pointed profiles.id at auth.users(id),
-- so Supabase owns credentials, sessions, password resets and the verification
-- email. We do not store a password hash and there is no auth_provider_id
-- column: the foreign key IS the seam.
--
-- email and email_verified_at are MIRRORED here from auth.users rather than
-- read across the schema boundary. Two reasons:
--
--   FR-02 gates posting, commenting and liking on verification, so that value
--   is read on nearly every write. A join into auth.users on each one is a
--   cross-schema join on the hot path.
--
--   FR-01 restricts the product to txstate.edu. A CHECK constraint cannot see
--   another table, so enforcing it in the database at all requires the address
--   to live on a row we own.
--
-- The mirror is maintained by the triggers at the bottom of this file. They are
-- the only writer; application code must never set these two columns.

alter table public.profiles
    add column email             citext,
    add column email_verified_at timestamptz,                       -- NULL = unverified (FR-02)
    add column home_college_id   uuid,                              -- FR-11, FK added after colleges
    add column post_karma        integer not null default 0,        -- likes received (FR-07)
    add column comment_karma     integer not null default 0,        -- likes received (FR-07)
    add column is_admin          boolean not null default false,    -- FR-96
    add column suspended_at      timestamptz,                       -- site-wide suspension (FR-96)
    add column deleted_at        timestamptz;

-- `college` was free text. FR-11 makes a home college a reference to a real
-- college space, so the directory, the crest navigation and "students in my
-- college" all work off one identifier instead of whatever the user typed.
-- `major` stays as text: there is no majors table and FR-05 only displays it.
alter table public.profiles drop column college;

-- username was `text`; FR-20-style handles are case-insensitive, so bobcatfan
-- and BobcatFan must collide rather than coexist.
alter table public.profiles alter column username type citext;

alter table public.profiles
    -- Cast to text first. A regex against citext matches case-INSENSITIVELY, so
    -- `username ~ '^[a-z0-9_]+$'` would happily accept "BobcatFan". The cast is
    -- what actually enforces lowercase.
    add constraint profiles_username_format
        check (username::text ~ '^[a-z0-9_]{3,20}$'),

    -- FR-01, enforced by the database and not only by application code. NULL is
    -- permitted so the row can be created before the trigger fills it in.
    add constraint profiles_txstate_email
        check (email is null or email ~ '@txstate\.edu$'),

    add constraint profiles_email_unique unique (email);


-- -------------------------------------------------------------------------
-- spaces
-- -------------------------------------------------------------------------
-- [D-2] THE CENTRAL DECISION IN THIS SCHEMA. Read this before reviewing
-- anything below it.
--
-- Posts live in one of three kinds of place: the General space (one row, for
-- anything university-wide), a college, or a user-created community. General is
-- a destination like the other two, not a view over them — a post belongs to
-- exactly one space and appears in exactly one feed (FR-60).
--
-- Those three behave identically almost everywhere. You follow them, you post
-- to them, they have a feed, they have moderators, they can ban you. They
-- differ only in who may create them and what extra attributes they carry.
--
-- So they are ONE table with a `kind` discriminator, rather than three tables
-- with three parallel sets of everything. The payoff is concrete:
--
--   posts.space_id     is one plain foreign key, not three nullable ones
--   follows            is one table covering FR-70 for colleges and communities
--   moderators, bans   are one table each instead of two
--   every feed query   is one query shape with an optional space filter (FR-65)
--
-- The cost is one join to reach college-specific columns, and the fact that
-- "which kinds may a user create" becomes an application rule rather than a
-- structural one.
--
-- DECIDED 2026-09-10: one table. Everything below assumes it. Reversing this
-- costs six tables and every feed query, so it is not a Week 9 decision.

create type space_kind as enum ('campus', 'college', 'community');

create table public.spaces (
    id             uuid primary key default gen_random_uuid(),
    kind           space_kind not null,
    slug           citext not null unique,          -- unique across ALL kinds: one URL namespace
    name           text not null,
    description    text not null default '',
    rules          text not null default '',        -- FR-22, FR-23
    created_by     uuid references public.profiles(id) on delete set null,  -- NULL for seeded colleges
    follower_count integer not null default 0,      -- denormalized (FR-73)
    post_count     integer not null default 0,      -- denormalized
    created_at     timestamptz not null default now(),
    deleted_at     timestamptz,

    -- FR-20. Colleges are seeded and may use a longer slug than users may
    -- claim; the 3-21 limit is enforced on communities only.
    constraint spaces_slug_format
        check (slug::text ~ '^[a-z0-9_]{3,32}$'),
    constraint spaces_community_slug_length
        check (kind <> 'community' or char_length(slug) between 3 and 21),

    -- FR-10. A community always has a creator; a seeded college never does.
    constraint spaces_authorship
        check (kind <> 'community' or created_by is not null)
);

-- Exactly one campus space can exist. It is the general Texas State feed (FR-60).
create unique index spaces_single_campus_idx on public.spaces ((kind)) where kind = 'campus';

-- FR-24 community directory and FR-13 college directory: same index, filtered by kind.
create index spaces_directory_idx on public.spaces (kind, follower_count desc, id desc)
    where deleted_at is null;
create index spaces_directory_new_idx on public.spaces (kind, created_at desc, id desc)
    where deleted_at is null;

-- FR-80: space names are searchable alongside post titles.
alter table public.spaces add column search_vector tsvector
    generated always as (to_tsvector('english', name)) stored;
create index spaces_search_idx on public.spaces using gin (search_vector);


-- -------------------------------------------------------------------------
-- colleges
-- -------------------------------------------------------------------------
-- The college-only attributes, kept out of `spaces` so communities do not carry
-- columns that are permanently NULL. One row per space of kind 'college'.
-- Seeded once, never written by the application (FR-10).

create table public.colleges (
    space_id   uuid primary key references public.spaces(id) on delete cascade,
    short_name text not null,                       -- "Science and Engineering"
    crest_key  text,                                -- crest asset, FR-13 navigation
    accent_hex text,                                -- per-college accent color
    sort_order smallint not null default 0,         -- fixed display order in the directory

    constraint colleges_accent_format
        check (accent_hex is null or accent_hex ~ '^#[0-9a-fA-F]{6}$')
);

-- FR-11. Declared here rather than inline above because colleges did not exist yet.
alter table public.profiles add constraint profiles_home_college_fk
    foreign key (home_college_id) references public.colleges(space_id) on delete set null;
create index profiles_home_college_idx on public.profiles (home_college_id);


-- -------------------------------------------------------------------------
-- follows
-- -------------------------------------------------------------------------
-- FR-70 through FR-73. One table covers colleges and communities because [D-2]
-- made them the same thing. The composite primary key IS FR-71: following twice
-- is not merely handled, it is impossible.
--
-- Nobody follows the campus space — it is everyone's by default (FR-60). That
-- is an application rule, not a constraint, so making campus followable later
-- is a one-line change.

create table public.follows (
    user_id     uuid not null references public.profiles(id) on delete cascade,
    space_id    uuid not null references public.spaces(id) on delete cascade,
    muted       boolean not null default false,     -- FR-72
    followed_at timestamptz not null default now(),

    primary key (user_id, space_id)                 -- FR-71
);

-- The PK serves the Following feed (FR-64). Follower lists need the other side.
create index follows_space_idx on public.follows (space_id);


-- -------------------------------------------------------------------------
-- moderators
-- -------------------------------------------------------------------------
-- FR-21, FR-93. Separate from `follows` on purpose: moderating is not a
-- stronger kind of following. A moderator need not follow the space, and
-- folding the two together puts a role column on every follower row that reads
-- 'member' in virtually all of them.

create table public.moderators (
    space_id   uuid not null references public.spaces(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    granted_by uuid references public.profiles(id) on delete set null,
    granted_at timestamptz not null default now(),

    primary key (space_id, user_id)
);

create index moderators_user_idx on public.moderators (user_id);


-- -------------------------------------------------------------------------
-- bans
-- -------------------------------------------------------------------------
-- FR-95.

create table public.bans (
    space_id   uuid not null references public.spaces(id) on delete cascade,
    user_id    uuid not null references public.profiles(id) on delete cascade,
    banned_by  uuid references public.profiles(id) on delete set null,
    reason     text,
    expires_at timestamptz,                         -- NULL = permanent
    created_at timestamptz not null default now(),

    primary key (space_id, user_id)
);


-- -------------------------------------------------------------------------
-- moderation status
-- -------------------------------------------------------------------------
-- FR-90, FR-91. The classifier screens content BEFORE it is visible, so status
-- is a column on the content itself rather than a row somewhere else. Every
-- feed query already filters on it, and a join per post to discover visibility
-- would be the most expensive join in the application.
--
--   'pending'   the classifier has not answered yet. Visible to the author only.
--   'approved'  published.
--   'blocked'   the classifier rejected it. Never published; the author is told.
--   'removed'   a human moderator took it down after publication (FR-93).
--
-- [D-4] WHAT HAPPENS WHEN THE CLASSIFIER DOES NOT ANSWER. UNDECIDED. FR-90 puts
-- a model call between "user pressed Post" and "post exists". That call can be
-- slow, time out, or return 503 because the model service is asleep. The schema
-- supports all three answers; the team must pick one and write it down, because
-- the difference is invisible in code review and obvious in a demo.
--
--   Fail closed   Post stays 'pending' and nobody but the author sees it.
--                 Nothing unscreened is ever published. But if the model is
--                 down during the final presentation, posts silently stop
--                 appearing and the app looks broken.
--
--   Fail open     Post is written 'approved' immediately and screened after.
--                 Always feels fast, always works. But content is readable
--                 before it has been checked, which is the one thing FR-90
--                 exists to prevent.
--
--   Bounded wait  Wait up to ~2 seconds. If the model answers, use the verdict.
--                 If it does not, fall back to 'pending' and let a background
--                 worker retry, with the author shown "under review".
--                 Recommended: the common case stays fast, and the failure case
--                 is safe rather than merely quiet.
--
-- Whichever is chosen, posts_pending_idx below is the query that finds content
-- stuck in screening. Someone has to actually look at it.
--
-- Editing (FR-33, FR-42) re-opens the same question: an edited body has not
-- been screened. Re-screen on edit, or the checker is trivially bypassed by
-- posting something clean and editing it afterwards.

create type moderation_status as enum ('pending', 'approved', 'blocked', 'removed');


-- -------------------------------------------------------------------------
-- posts
-- -------------------------------------------------------------------------

create type post_type as enum ('text', 'link', 'image');

create table public.posts (
    id            uuid primary key default gen_random_uuid(),
    space_id      uuid not null references public.spaces(id) on delete cascade,  -- FR-30, one FK thanks to [D-2]
    author_id     uuid references public.profiles(id) on delete set null,        -- survives author deletion
    type          post_type not null,
    title         text not null,
    body          text,                             -- text posts
    url           text,                             -- link posts
    image_key     text,                             -- image posts, storage key (FR-32)
    like_count    integer not null default 0,       -- denormalized (FR-52)
    comment_count integer not null default 0,       -- denormalized (FR-36)
    hot_rank      double precision not null default 0,  -- precomputed (FR-54)
    status        moderation_status not null default 'pending',  -- FR-90
    created_at    timestamptz not null default now(),
    edited_at     timestamptz,                      -- FR-33
    deleted_at    timestamptz,                      -- soft delete (FR-34)
    removed_by    uuid references public.profiles(id) on delete set null,  -- FR-93

    constraint posts_title_length check (char_length(title) between 1 and 300),  -- FR-31

    -- FR-31: exactly one body type, enforced structurally rather than in a validator.
    constraint posts_body_matches_type check (
        (type = 'text'  and body      is not null and url is null and image_key is null) or
        (type = 'link'  and url       is not null and body is null and image_key is null) or
        (type = 'image' and image_key is not null and body is null and url is null)
    )
);

-- Feed indexes (FR-61 through FR-65).
--
-- Two things in every one of these are load-bearing:
--
--   the trailing `id desc` makes the sort key unique, which is what lets cursor
--   pagination be stable rather than merely paginated (FR-66);
--
--   the partial WHERE means a tombstoned or blocked row is not in the index at
--   all, so it costs nothing on read (FR-90).
--
-- Every feed in this product is scoped to a space, including the general one —
-- 'general' is a place you post to, not a blend of everything (FR-60). So these
-- three all lead with space_id, and there are no unscoped equivalents. The
-- Following feed is these same indexes with space_id = any(...) (FR-64).
--
-- If an "everything at once" discovery feed is ever wanted, it needs three more
-- indexes identical to these minus the space_id column. Deliberately not added
-- now: an index nobody reads still costs a write on every single post.

create index posts_space_hot_idx on public.posts (space_id, hot_rank desc, id desc)
    where deleted_at is null and status = 'approved';
create index posts_space_new_idx on public.posts (space_id, created_at desc, id desc)
    where deleted_at is null and status = 'approved';
create index posts_space_top_idx on public.posts (space_id, like_count desc, id desc)
    where deleted_at is null and status = 'approved';           -- FR-61, FR-62, FR-63

create index posts_author_idx on public.posts (author_id, created_at desc);     -- FR-05
create index posts_pending_idx on public.posts (created_at) where status = 'pending';  -- stuck-screening queue

-- FR-80: full-text search over titles. A generated column stays in sync by
-- itself, so there is no trigger to forget.
alter table public.posts add column search_vector tsvector
    generated always as (to_tsvector('english', title)) stored;
create index posts_search_idx on public.posts using gin (search_vector);


-- -------------------------------------------------------------------------
-- comments
-- -------------------------------------------------------------------------
-- [D-3] Materialized path. `path` holds the ancestry as an ltree, for example
-- '0001.0004.0009'. Fetching an entire thread, correctly sorted, is then one
-- indexed query with no recursion:
--
--     select * from comments where post_id = $1 order by path;
--
-- parent_id is kept ALONGSIDE path deliberately. path makes reads fast;
-- parent_id keeps referential integrity real and gives us a way to rebuild
-- paths if they ever drift. The redundancy is intentional, and the two must
-- always be written in the same statement.
--
-- The alternative is an adjacency list — parent_id alone — which is trivial to
-- insert into and needs a recursive CTE to read. We read threads constantly and
-- insert into them comparatively rarely, so the cost belongs on the write.

create table public.comments (
    id         uuid primary key default gen_random_uuid(),
    post_id    uuid not null references public.posts(id) on delete cascade,
    parent_id  uuid references public.comments(id) on delete cascade,  -- NULL = top level
    author_id  uuid references public.profiles(id) on delete set null,
    path       ltree not null,                      -- [D-3]
    depth      smallint not null,                   -- = nlevel(path) - 1
    body       text not null,
    like_count integer not null default 0,          -- denormalized (FR-45)
    status     moderation_status not null default 'pending',   -- FR-90
    created_at timestamptz not null default now(),
    edited_at  timestamptz,                         -- FR-42
    deleted_at timestamptz,                         -- tombstone (FR-43)
    removed_by uuid references public.profiles(id) on delete set null,  -- FR-93

    constraint comments_depth_limit check (depth between 0 and 12)  -- FR-41 needs >= 8
);

create index comments_post_path_idx on public.comments (post_id, path);   -- FR-35, one tree query
create index comments_path_gist_idx on public.comments using gist (path); -- FR-44 subtree fetch
create index comments_post_likes_idx on public.comments (post_id, like_count desc, id desc)
    where deleted_at is null and status = 'approved';                     -- FR-45
create index comments_author_idx on public.comments (author_id, created_at desc);  -- FR-05
create index comments_pending_idx on public.comments (created_at) where status = 'pending';

-- FR-81. A generated tsvector over comment bodies is cheap to add now and
-- expensive to backfill across 50,000 rows later.
alter table public.comments add column search_vector tsvector
    generated always as (to_tsvector('english', body)) stored;
create index comments_search_idx on public.comments using gin (search_vector);


-- -------------------------------------------------------------------------
-- likes
-- -------------------------------------------------------------------------
-- FR-50, FR-51. Upvotes only — this product has no downvote, so there is no
-- `value` column holding +1/-1 and no reversal arithmetic to get wrong. A like
-- is the existence of the row. Unliking is a DELETE.
--
-- The composite primary key IS FR-50. One like per user per item is not
-- enforced by application code; it is structurally impossible to violate.
--
-- Two tables rather than one polymorphic table. These sit on the hottest read
-- path in the application, so real foreign keys and a plain composite key are
-- worth more than avoiding near-duplicate DDL.

create table public.post_likes (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    post_id    uuid not null references public.posts(id) on delete cascade,
    created_at timestamptz not null default now(),

    primary key (user_id, post_id)                  -- FR-50
);

-- Answers "has THIS viewer liked any of these 25 posts" in one join (FR-53).
create index post_likes_post_idx on public.post_likes (post_id);

create table public.comment_likes (
    user_id    uuid not null references public.profiles(id) on delete cascade,
    comment_id uuid not null references public.comments(id) on delete cascade,
    created_at timestamptz not null default now(),

    primary key (user_id, comment_id)               -- FR-50
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);


-- -------------------------------------------------------------------------
-- moderation_checks
-- -------------------------------------------------------------------------
-- FR-92. The classifier's verdict, kept as an audit trail separate from the
-- content's current status.
--
-- The status column on posts and comments answers "is this visible right now",
-- which is what every read needs. This table answers "what did the model say,
-- which version said it, how sure was it, and did a human overturn it" — which
-- is what tuning a threshold and defending a false positive need, and which
-- would otherwise be lost the moment a moderator changed the status.
--
-- This one IS polymorphic, which contradicts the two-table decision for likes
-- above. The difference is traffic: checks are written once per submission,
-- never joined on a feed query, and read as a single mixed queue. The rule is
-- not "never polymorphic" — it is "not on a hot path."

create type moderation_label as enum (
    'clean', 'harassment', 'hate', 'sexual_content', 'violence', 'self_harm', 'spam'
);
create type moderation_decision as enum ('allow', 'block');

create table public.moderation_checks (
    id            uuid primary key default gen_random_uuid(),
    post_id       uuid references public.posts(id) on delete cascade,
    comment_id    uuid references public.comments(id) on delete cascade,
    label         moderation_label not null,        -- highest-scoring class
    score         real not null,                    -- that class's confidence, 0..1
    decision      moderation_decision not null,     -- FR-91
    model_version text not null,                    -- which model said it
    latency_ms    integer,                          -- FR-90 sits on the write path; watch it
    overridden_by uuid references public.profiles(id) on delete set null,  -- a human overturned it
    overridden_at timestamptz,
    created_at    timestamptz not null default now(),

    constraint moderation_checks_one_target check (num_nonnulls(post_id, comment_id) = 1),
    constraint moderation_checks_score_range check (score >= 0 and score <= 1)
);

create index moderation_checks_post_idx    on public.moderation_checks (post_id)    where post_id is not null;
create index moderation_checks_comment_idx on public.moderation_checks (comment_id) where comment_id is not null;

-- The tuning query: everything the model blocked, newest first.
create index moderation_checks_blocked_idx on public.moderation_checks (created_at desc)
    where decision = 'block';


-- -------------------------------------------------------------------------
-- reports
-- -------------------------------------------------------------------------
-- FR-97, FR-98, FR-99. Human reporting, which exists precisely because the
-- classifier will miss things. The two mechanisms answer different questions
-- and neither replaces the other:
--
--   moderation_checks  what the MODEL thought, at submission time, automatically
--   reports            what a PERSON thought, after publication, deliberately
--
-- A report on content the model marked 'clean' is the single most valuable row
-- in this database — it is a labelled false negative, which is exactly what
-- retraining or threshold-tuning needs.
--
-- FR-99 adds a third target: an account. A pattern of behaviour is the thing a
-- content report cannot express — someone whose every individual post is
-- defensible but who is following one student from thread to thread is
-- invisible to a per-post queue. So the target is the person, and it goes to a
-- different desk: a person does not live inside a space, so no space moderator
-- owns the complaint. Site administrators do (FR-96), and the outcome is
-- profiles.suspended_at rather than a removed row.

create type report_reason as enum (
    'spam', 'harassment', 'hate', 'violence', 'sexual_content', 'misinformation', 'other'
);
create type report_status as enum ('open', 'resolved', 'dismissed');

create table public.reports (
    id               uuid primary key default gen_random_uuid(),
    reporter_id      uuid not null references public.profiles(id) on delete cascade,
    post_id          uuid references public.posts(id) on delete cascade,
    comment_id       uuid references public.comments(id) on delete cascade,
    reported_user_id uuid references public.profiles(id) on delete cascade,  -- FR-99
    space_id         uuid references public.spaces(id) on delete cascade,    -- FR-98 queue scope
    reason           report_reason not null,               -- FR-97, FR-99
    detail           text,
    status           report_status not null default 'open',  -- FR-98
    resolved_by      uuid references public.profiles(id) on delete set null,
    resolved_at      timestamptz,
    created_at       timestamptz not null default now(),

    constraint reports_one_target check (num_nonnulls(post_id, comment_id, reported_user_id) = 1),

    -- Which desk this lands on, enforced structurally so a report cannot be
    -- filed into nobody's queue. Content is always inside a space and belongs
    -- to that space's moderators; an account is inside none and belongs to the
    -- administrators (FR-96).
    constraint reports_routing check (
        (reported_user_id is null     and space_id is not null) or
        (reported_user_id is not null and space_id is null)
    ),

    -- Reporting yourself is not a thing anyone needs to do, and a self-report is
    -- a cheap way to clutter the admin queue.
    constraint reports_no_self_report check (reported_user_id is distinct from reporter_id)
);

-- space_id is copied here rather than reached through post -> space. A moderator
-- queue filters by space on every load (FR-98), and for a comment that lookup is
-- otherwise comment -> post -> space, two joins deep. It is denormalized, so it
-- must be written from the target's space at insert time and never updated. It
-- is NULL on account reports, which have no space (FR-99).

-- FR-97: one report per person per item. Stops one user flooding the queue.
create unique index reports_unique_post_idx
    on public.reports (reporter_id, post_id) where post_id is not null;
create unique index reports_unique_comment_idx
    on public.reports (reporter_id, comment_id) where comment_id is not null;

-- FR-99: one OPEN report per reporter per account, rather than one ever. A
-- student reported in September who reoffends in November has to be reportable
-- again — but one who is already in the queue should not be reportable ten more
-- times by the same person while that report is still sitting there. The
-- partial unique index says exactly that, and resolving the report releases it.
create unique index reports_unique_user_idx on public.reports (reporter_id, reported_user_id)
    where reported_user_id is not null and status = 'open';

-- FR-98: the queue itself — open reports for one space, oldest first.
create index reports_open_queue_idx on public.reports (space_id, created_at)
    where status = 'open' and space_id is not null;

-- FR-99: the admin queue — open account reports, oldest first. Separate index
-- because no space filter applies and no moderator may read it.
create index reports_open_admin_idx on public.reports (created_at)
    where status = 'open' and reported_user_id is not null;

-- FR-99: "how many open complaints does this account have" — the number that
-- decides whether a pattern exists. Without it that question is a sequential
-- scan of the whole table.
create index reports_reported_user_idx on public.reports (reported_user_id, created_at desc)
    where reported_user_id is not null;


-- =========================================================================
-- Keeping profiles in step with auth.users
-- =========================================================================
-- These two triggers are the only writer of profiles.email and
-- profiles.email_verified_at. Application code must never set them.
--
-- handle_new_user also creates the profile row itself, so a student who
-- completes Supabase signup always has somewhere for their posts to point.
-- Without it, signup succeeds and the very first authenticated request fails on
-- a missing profile — the classic Supabase bug, and it only shows up for real
-- new users, never for the seeded ones you test with.

-- FR-01, at the only place it can be enforced for real. The CHECK on
-- profiles.email catches our own bad writes; this catches a signup, which is
-- what actually happens. Raising here aborts the whole signup transaction.
create or replace function public.enforce_txstate_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.email is null or new.email !~ '@txstate\.edu$' then
        raise exception 'TXST Lynx is limited to txstate.edu addresses (FR-01)'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

create trigger enforce_txstate_email_trg
    before insert on auth.users
    for each row execute function public.enforce_txstate_email();


-- Username is provisional: a signup has no username yet, so we derive one from
-- the address and let the student change it later (FR-06). The loop is for the
-- collision between two people whose addresses differ only outside [a-z0-9_].
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    base_name text;
    candidate text;
    suffix    integer := 0;
begin
    base_name := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));

    if char_length(base_name) < 3 then
        base_name := base_name || 'bobcat';
    end if;
    base_name := left(base_name, 16);
    candidate := base_name;

    -- No ::citext cast here: search_path is empty inside this function, so an
    -- unqualified type name does not resolve. Every stored username is lower
    -- case by constraint, so a text comparison is equivalent.
    while exists (select 1 from public.profiles p where p.username::text = candidate) loop
        suffix    := suffix + 1;
        candidate := left(base_name, 16) || suffix::text;
    end loop;

    insert into public.profiles (id, username, email, email_verified_at, created_at, updated_at)
    values (new.id, candidate, new.email, new.email_confirmed_at, now(), now());

    return new;
end;
$$;

create trigger handle_new_user_trg
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- FR-02. Verification happens minutes or days after signup, when the student
-- clicks the emailed link. Supabase stamps auth.users.email_confirmed_at; this
-- mirrors it so the gate on posting is a column read, not a cross-schema join.
create or replace function public.sync_email_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.profiles
       set email_verified_at = new.email_confirmed_at,
           email             = new.email,
           updated_at        = now()
     where id = new.id;
    return new;
end;
$$;

create trigger sync_email_verified_trg
    after update of email_confirmed_at, email on auth.users
    for each row execute function public.sync_email_verified();


-- =========================================================================
-- Row Level Security
-- =========================================================================
-- The previous migration turned RLS on for profiles. Every table added here
-- turns it on too, because a public table without RLS in a Supabase project is
-- readable and writable by anyone holding the anon key — which is shipped to
-- the browser.
--
-- These policies cover READS only, plus the two writes that are purely a user's
-- own business. Everything else — creating a post, moderating, banning, ruling
-- on a report — goes through FastAPI using the service role, which bypasses RLS
-- entirely. That is deliberate: FR-90 (screen before publish), FR-94 (rate
-- limits) and FR-93 (moderator scope) are multi-step rules, and a policy that
-- tried to express them would be a second, silent copy of the API's logic.
--
-- So the rule for the team is: if the browser can do it by itself, it is a
-- policy here. If it needs a decision, it is an endpoint.

alter table public.spaces            enable row level security;
alter table public.colleges          enable row level security;
alter table public.follows           enable row level security;
alter table public.moderators        enable row level security;
alter table public.bans              enable row level security;
alter table public.posts             enable row level security;
alter table public.comments          enable row level security;
alter table public.post_likes        enable row level security;
alter table public.comment_likes     enable row level security;
alter table public.moderation_checks enable row level security;
alter table public.reports           enable row level security;

-- FR-04: signed-out visitors get read-only access to all public content.
create policy spaces_public_read on public.spaces
    for select using (deleted_at is null);

create policy colleges_public_read on public.colleges
    for select using (true);

-- FR-90: 'pending' and 'blocked' content is visible to its author and nobody
-- else. This is the policy that makes screening real rather than cosmetic.
create policy posts_public_read on public.posts
    for select using (
        (deleted_at is null and status = 'approved')
        or author_id = (select auth.uid())
    );

create policy comments_public_read on public.comments
    for select using (
        status = 'approved'
        or author_id = (select auth.uid())
    );

-- FR-52, FR-53: like counts are public, and a signed-in reader needs to know
-- which of these 25 posts they have already liked.
create policy post_likes_public_read on public.post_likes
    for select using (true);
create policy comment_likes_public_read on public.comment_likes
    for select using (true);

-- FR-73: follower counts and "do I follow this" are both public reads.
create policy follows_public_read on public.follows
    for select using (true);

-- FR-22: a community page lists its moderators.
create policy moderators_public_read on public.moderators
    for select using (true);

-- FR-50, FR-51: liking and unliking are the two writes a browser may do alone.
-- The row must be the caller's own, and FR-02 requires a verified account.
create policy post_likes_insert_own on public.post_likes
    for insert with check (
        user_id = (select auth.uid())
        and exists (
            select 1 from public.profiles p
             where p.id = (select auth.uid())
               and p.email_verified_at is not null
               and p.suspended_at is null
        )
    );
create policy post_likes_delete_own on public.post_likes
    for delete using (user_id = (select auth.uid()));

create policy comment_likes_insert_own on public.comment_likes
    for insert with check (
        user_id = (select auth.uid())
        and exists (
            select 1 from public.profiles p
             where p.id = (select auth.uid())
               and p.email_verified_at is not null
               and p.suspended_at is null
        )
    );
create policy comment_likes_delete_own on public.comment_likes
    for delete using (user_id = (select auth.uid()));

-- FR-70, FR-71, FR-72: following, unfollowing and muting are the user's own.
create policy follows_write_own on public.follows
    for all using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- bans, moderation_checks and reports get RLS with NO read policy on purpose.
-- A ban list, the classifier's verdicts and an open report queue are all
-- moderator-facing, and they reach the moderator through FastAPI. RLS on with
-- no policy means the anon key sees nothing at all, which is the intent.


-- =========================================================================
-- Seed: the General space and the colleges
-- =========================================================================
-- FR-10, FR-60. These rows are part of the schema's meaning, not test data —
-- the application cannot function without them, so they belong in the migration
-- rather than in a seeder.
--
-- [D-5] UNDECIDED: colleges or departments? This list is the ten actual TXST
-- colleges, so a computer science student lands in one bucket with biology,
-- math and engineering. A per-department list (~40-50 spaces) would give CS its
-- own feed, which is closer to what was described as "each college like
-- computer science feed". It is a change to this INSERT and nothing else, but
-- it changes how the product feels, so decide it before the demo.
--
-- Verify against the current university catalog before merging.

insert into public.spaces (kind, slug, name, description) values
    ('campus', 'general', 'General',
     'Anything for the whole university. Not tied to a college or a community.');

insert into public.spaces (kind, slug, name) values
    ('college', 'applied_arts',        'College of Applied Arts'),
    ('college', 'business',            'McCoy College of Business'),
    ('college', 'education',           'College of Education'),
    ('college', 'fine_arts',           'College of Fine Arts and Communication'),
    ('college', 'health_professions',  'College of Health Professions'),
    ('college', 'liberal_arts',        'College of Liberal Arts'),
    ('college', 'science_engineering', 'College of Science and Engineering'),
    ('college', 'university_college',  'University College'),
    ('college', 'honors',              'Honors College'),
    ('college', 'graduate',            'The Graduate College');

insert into public.colleges (space_id, short_name, sort_order)
select id,
       replace(replace(name, 'College of ', ''), 'McCoy College of ', ''),
       row_number() over (order by name)
from public.spaces
where kind = 'college';


-- =========================================================================
-- Notes carried forward
-- =========================================================================
--
-- Denormalized counters. posts.like_count, posts.comment_count,
-- comments.like_count, spaces.follower_count, spaces.post_count,
-- profiles.post_karma and profiles.comment_karma are all caches of a count(*)
-- that would otherwise run on every page load. Each must be written in the SAME
-- TRANSACTION as the row it summarizes, and each can still drift. Write the
-- reconciliation query early and assert it in tests — the bug is invisible
-- until somebody notices a post claiming 12 likes with 11 rows behind it.
--
-- Hot rank (FR-54). With no downvotes, like_count is never negative and the
-- usual sign handling drops out:
--
--     log(greatest(like_count, 1)) + extract(epoch from created_at) / 45000
--
-- Compute it on write, store it, index it. Never compute a ranking at read
-- time. One order of magnitude of likes is worth about 12.5 hours of age.
--
-- Rate limiting (FR-94) needs no table. Count a user's posts since
-- now() - interval '10 minutes' using posts_author_idx.
--
-- Images (FR-32) never enter this database and never transit the API server.
-- Store the object key in image_key; upload browser-to-storage with a Supabase
-- signed URL. A container's filesystem is ephemeral and uploaded images vanish
-- on redeploy.
--
-- Moderation on the write path. See [D-4]. It is the decision most likely to be
-- discovered by accident during the final demo rather than settled on purpose
-- in Week 3.
--
-- Account reports need somewhere to land (FR-99). The table routes them to the
-- administrators, but a queue nobody opens is the same as no queue. Decide who
-- reads it and what the outcomes are before the feature ships: dismiss, warn,
-- ban from one space (bans), or suspend site-wide (profiles.suspended_at).
-- Three of those four already exist here; only "warn" would need a new row.
--
-- Reports are training data. A report (FR-97) on content the classifier passed
-- as 'clean' is a labelled false negative. Join reports to moderation_checks on
-- the target and the team has a real evaluation set for the model, from the
-- app's own users, at no extra cost. Build the join early even if nobody uses
-- it until Week 12.
