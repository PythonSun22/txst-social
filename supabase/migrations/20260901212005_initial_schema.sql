-- =========================================================
-- TXST LYNX
-- Initial Schema
--
-- Supabase Auth manages account credentials in auth.users.
-- This table stores Lynx profile information.
-- =========================================================

create table public.profiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    username text not null unique,

    display_name text,

    bio text,

    college text,

    major text,

    profile_image_url text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- Enable Row Level Security
alter table public.profiles
    enable row level security;
