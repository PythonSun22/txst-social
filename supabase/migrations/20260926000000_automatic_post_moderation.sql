-- FR-90–92: the post row is a durable queue; crashes never reset its budget.
alter table public.posts
    add column moderation_attempts integer not null default 0 check (moderation_attempts >= 0),
    add column moderation_next_attempt_at timestamptz not null default now(),
    add column moderation_claim uuid,
    add column moderation_lease_until timestamptz,
    add column moderation_exhausted_at timestamptz,
    add column moderation_error text;

create index posts_moderation_queue_idx on public.posts (created_at, id)
    where status = 'pending' and deleted_at is null and moderation_exhausted_at is null;

-- Preserve all provider flags, not just the legacy highest-scoring category.
alter type moderation_label add value if not exists 'illicit';
alter type moderation_label add value if not exists 'other';
alter table public.moderation_checks
    add column provider_result jsonb,
    add column content_hash text,
    add column policy_version text,
    add column attempt integer check (attempt > 0);

-- Existing RLS remains in place. No browser write policies or public audit reads
-- are added. Existing pending General rows become eligible without auto-approval.
