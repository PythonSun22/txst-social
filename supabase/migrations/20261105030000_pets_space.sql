-- FR-20/24: built-in Pets community in General spaces.
insert into public.spaces (kind, slug, name, description, is_seeded) values
    ('community', 'pets', 'Pets', 'Share your pets, swap care tips, and meet fellow animal lovers.', true)
on conflict (slug) do nothing;
