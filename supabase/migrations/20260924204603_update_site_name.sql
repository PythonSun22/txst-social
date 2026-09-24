-- Branding only (FR-01). Existing databases do not rerun the core migration.
-- Keep the domain check and trigger behavior unchanged.
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
