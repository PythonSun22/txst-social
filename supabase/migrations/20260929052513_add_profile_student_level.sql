-- FR-05/FR-06: a student's academic level is optional public profile data.
create type profile_student_level as enum (
    'freshman',
    'sophomore',
    'junior',
    'senior',
    'graduate'
);

alter table public.profiles
    add column student_level profile_student_level;
