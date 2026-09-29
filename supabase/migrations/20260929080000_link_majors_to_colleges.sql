-- FR-06/FR-11: a selectable major belongs to one academic college.
-- The catalog's program hierarchy is the source of these assignments.

alter table public.majors
    add column college_id uuid;

update public.majors as major
set college_id = college.id
from public.spaces as college
where college.kind = 'college'
  and college.slug = case
    when major.name in (
        'Agricultural Business and Management', 'Agriculture', 'Animal Science',
        'Applied Arts and Sciences', 'Artificial Intelligence', 'Aviation',
        'Consumer Affairs', 'Criminal Justice', 'Data Analytics',
        'Fashion Merchandising', 'Human Development and Family Sciences',
        'Information Technology', 'Interior Design', 'Nutrition and Foods',
        'Social Work'
    ) then 'applied_arts'
    when major.name in (
        'Accounting', 'Business Analytics', 'Economics', 'Finance',
        'Finance/Quantitative Finance and Economics', 'Information Systems',
        'Management', 'Marketing'
    ) then 'business'
    when major.name in (
        'Education', 'Exercise and Sports Science', 'Health and Fitness Management',
        'Integrated Studies', 'Public Health', 'Recreation and Sport Management'
    ) then 'education'
    when major.name in (
        'Acting for Stage and Screen', 'Advertising', 'Applied Communication',
        'Art', 'Art Education', 'Art History', 'Communication Design',
        'Communication Studies', 'Dance', 'Digital Media Innovation',
        'Electronic Media', 'Journalism', 'Mass Communication', 'Music',
        'Music Studies', 'Musical Theatre', 'Performance', 'Photography',
        'Public Relations', 'Sound Recording Technology', 'Studio Art', 'Theatre'
    ) then 'fine_arts'
    when major.name in (
        'Communication Disorders', 'Health Informatics',
        'Health Information Management', 'Health Sciences',
        'Healthcare Administration', 'Medical Laboratory Science', 'Nursing',
        'Radiation Therapy', 'Respiratory Care'
    ) then 'health_professions'
    when major.name in (
        'Anthropology', 'Applied Sociology', 'English',
        'English/Technical Communication', 'French',
        'Geographic Information Science', 'Geography',
        'Geography and Environmental Studies',
        'Geography Natural Resources and Environmental Studies',
        'Geography Urban and Regional Planning', 'Geography Water Resources',
        'German', 'History', 'Human Geography', 'International Relations',
        'International Studies', 'Philosophy', 'Physical Geography',
        'Political Science', 'Psychology', 'Public Administration',
        'Religious Studies', 'Sociology', 'Spanish'
    ) then 'liberal_arts'
    when major.name in (
        'Applied Mathematics', 'Aquatic Biology', 'Biochemistry', 'Biology',
        'Chemistry', 'Civil Engineering', 'Computer Science',
        'Concrete Industry Management', 'Construction Science and Management',
        'Data Science', 'Electrical Engineering', 'Engineering Technology',
        'Industrial Engineering', 'Industrial Engineering/Engineering',
        'Industrial Engineering/Industrial and Business Operations Engineering',
        'Manufacturing Engineering', 'Mathematics', 'Mechanical Engineering',
        'Mechatronics Engineering', 'Microbiology and Molecular Genetics',
        'Physics', 'Wildlife Biology'
    ) then 'science_engineering'
  end;

do $$
begin
    if exists (select 1 from public.majors where college_id is null) then
        raise exception 'Every seeded major must map to a college';
    end if;
end
$$;

alter table public.majors
    alter column college_id set not null,
    add constraint majors_college_id_fkey
        foreign key (college_id) references public.colleges(space_id)
        on delete restrict;

create index majors_college_active_order_idx
    on public.majors (college_id, sort_order)
    where active;
