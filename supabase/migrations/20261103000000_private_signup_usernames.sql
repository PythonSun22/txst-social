-- FR-06: new profiles receive an unrelated provisional handle until choice.
alter table public.profiles
    add column username_chosen_at timestamptz;

-- Existing developer accounts already have their usernames.
update public.profiles set username_chosen_at = now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    candidate text;
begin
    loop
        -- 60 random bits keep handles short and unrelated to a student's NetID.
        candidate := 'lynx_' || left(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 15);

        insert into public.profiles (id, username, email, email_verified_at, created_at, updated_at)
        values (new.id, candidate, new.email, new.email_confirmed_at, now(), now())
        on conflict (username) do nothing;

        exit when found;
    end loop;

    return new;
end;
$$;
