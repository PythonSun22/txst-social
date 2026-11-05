-- FR-06/11/70: remember completion independently of later editable metadata.
alter table public.profiles add column academic_setup_completed_at timestamptz;

-- Accounts that already finished the old username-only signup remain complete.
-- New users and users still choosing a username complete the new academic step.
update public.profiles set academic_setup_completed_at = now()
where username_chosen_at is not null;
