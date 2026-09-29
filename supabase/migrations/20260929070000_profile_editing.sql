-- FR-05/FR-06: normalized profile choices and reusable uploaded avatars.
-- Source: TXST 2026-2027 Undergraduate Majors catalog.

create table public.majors (
    id          uuid primary key default gen_random_uuid(),
    name        text not null check (length(name) between 1 and 120),
    degree      text not null check (length(degree) between 1 and 40),
    sort_order  smallint not null,
    active      boolean not null default true,
    unique (name, degree)
);

alter table public.majors enable row level security;

create policy majors_public_read on public.majors
    for select using (active);

alter table public.profiles
    add column major_id uuid references public.majors(id) on delete set null,
    add column profile_image_upload_id uuid
        references public.image_uploads(id) on delete set null,
    add column banner_image_upload_id uuid
        references public.image_uploads(id) on delete set null;

insert into public.majors (name, degree, sort_order)
select name, degree, row_number() over (order by name, degree)
from (values
    ('Accounting', 'B.B.A.'),
    ('Accounting', 'B.B.A./M.Acy.'),
    ('Acting for Stage and Screen', 'B.F.A.'),
    ('Advertising', 'B.S.'),
    ('Agricultural Business and Management', 'B.S.A.G.'),
    ('Agriculture', 'B.S.A.G.'),
    ('Animal Science', 'B.S.A.G.'),
    ('Anthropology', 'B.A.'),
    ('Anthropology', 'B.S.'),
    ('Applied Arts and Sciences', 'B.A.A.S.'),
    ('Applied Communication', 'B.S.'),
    ('Applied Mathematics', 'B.S.'),
    ('Applied Sociology', 'B.S.'),
    ('Aquatic Biology', 'B.S.'),
    ('Art', 'B.A.'),
    ('Art Education', 'B.F.A.'),
    ('Art History', 'B.A.'),
    ('Artificial Intelligence', 'B.A.A.S.'),
    ('Aviation', 'B.A.A.S.'),
    ('Biochemistry', 'B.S.'),
    ('Biology', 'B.S.'),
    ('Business Analytics', 'B.B.A.'),
    ('Chemistry', 'B.S.'),
    ('Civil Engineering', 'B.S.'),
    ('Communication Design', 'B.F.A.'),
    ('Communication Disorders', 'B.S.C.D.'),
    ('Communication Studies', 'B.A.'),
    ('Computer Science', 'B.A.'),
    ('Computer Science', 'B.S.'),
    ('Computer Science', 'B.S./M.S.'),
    ('Concrete Industry Management', 'B.S.'),
    ('Construction Science and Management', 'B.S.'),
    ('Consumer Affairs', 'B.S.F.C.S.'),
    ('Criminal Justice', 'B.S.C.J.'),
    ('Dance', 'B.A.'),
    ('Dance', 'B.F.A.'),
    ('Data Analytics', 'B.A.A.S.'),
    ('Data Science', 'B.S.'),
    ('Digital Media Innovation', 'B.S.'),
    ('Economics', 'B.A.'),
    ('Economics', 'B.B.A.'),
    ('Education', 'B.A.'),
    ('Education', 'B.S.'),
    ('Electrical Engineering', 'B.S.'),
    ('Electronic Media', 'B.S.'),
    ('Engineering Technology', 'B.S.'),
    ('English', 'B.A.'),
    ('English/Technical Communication', 'B.A./M.A.'),
    ('Exercise and Sports Science', 'B.S.'),
    ('Fashion Merchandising', 'B.S.F.C.S.'),
    ('Finance', 'B.B.A.'),
    ('Finance/Quantitative Finance and Economics', 'B.B.A./M.S.'),
    ('French', 'B.A.'),
    ('Geographic Information Science', 'B.S.'),
    ('Geography', 'B.S.'),
    ('Geography and Environmental Studies', 'B.S.'),
    ('Geography Natural Resources and Environmental Studies', 'B.S.'),
    ('Geography Urban and Regional Planning', 'B.S.'),
    ('Geography Water Resources', 'B.S.'),
    ('German', 'B.A.'),
    ('Health and Fitness Management', 'B.E.S.S.'),
    ('Health Informatics', 'B.S.'),
    ('Health Information Management', 'B.S.H.I.M.'),
    ('Health Sciences', 'B.S.'),
    ('Healthcare Administration', 'B.H.A.'),
    ('History', 'B.A.'),
    ('Human Development and Family Sciences', 'B.S.F.C.S.'),
    ('Human Geography', 'B.A.'),
    ('Industrial Engineering', 'B.S.'),
    ('Industrial Engineering/Engineering', 'B.S./M.S.'),
    ('Industrial Engineering/Industrial and Business Operations Engineering', 'B.S./M.S.'),
    ('Information Systems', 'B.B.A.'),
    ('Information Technology', 'B.A.A.S.'),
    ('Integrated Studies', 'B.G.S.'),
    ('Interior Design', 'B.S.F.C.S.'),
    ('International Relations', 'B.A.I.S.'),
    ('International Studies', 'B.A.'),
    ('Journalism', 'B.S.'),
    ('Management', 'B.B.A.'),
    ('Manufacturing Engineering', 'B.S.'),
    ('Marketing', 'B.B.A.'),
    ('Mass Communication', 'B.A.'),
    ('Mass Communication', 'B.S.'),
    ('Mathematics', 'B.A.'),
    ('Mathematics', 'B.S.'),
    ('Mechanical Engineering', 'B.S.'),
    ('Mechatronics Engineering', 'B.S.'),
    ('Medical Laboratory Science', 'B.S.M.L.S.'),
    ('Microbiology and Molecular Genetics', 'B.S.'),
    ('Music', 'B.A.'),
    ('Music Studies', 'B.M.'),
    ('Musical Theatre', 'B.F.A.'),
    ('Nursing', 'B.S.N.'),
    ('Nutrition and Foods', 'B.S.F.C.S.'),
    ('Performance', 'B.M.'),
    ('Philosophy', 'B.A.'),
    ('Photography', 'B.F.A.'),
    ('Physical Geography', 'B.S.'),
    ('Physics', 'B.A.'),
    ('Physics', 'B.S.'),
    ('Political Science', 'B.A.'),
    ('Political Science', 'B.A./M.A.'),
    ('Psychology', 'B.A.'),
    ('Psychology', 'B.S.'),
    ('Public Administration', 'B.P.A.'),
    ('Public Administration', 'B.P.A./M.P.A.'),
    ('Public Health', 'B.S.'),
    ('Public Relations', 'B.S.'),
    ('Radiation Therapy', 'B.S.R.T.'),
    ('Recreation and Sport Management', 'B.S.'),
    ('Religious Studies', 'B.A.'),
    ('Respiratory Care', 'B.S.R.C.'),
    ('Social Work', 'B.S.W.'),
    ('Sociology', 'B.A.'),
    ('Sound Recording Technology', 'B.S.'),
    ('Spanish', 'B.A.'),
    ('Studio Art', 'B.F.A.'),
    ('Theatre', 'B.A.'),
    ('Theatre', 'B.F.A.'),
    ('Wildlife Biology', 'B.S.')
) as catalog(name, degree);

-- Preserve existing free-text profile data when it exactly matches a catalog major.
update public.profiles as profile
set major_id = (
    select id
    from public.majors
    where lower(name) = lower(profile.major)
    order by sort_order
    limit 1
)
where profile.major is not null;
