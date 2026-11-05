-- FR-20/24: ninth built-in community for the general spaces directory.
insert into public.spaces (kind, slug, name, description, is_seeded) values
    ('community', 'music', 'Music', 'Share music, discover local shows, and connect with fellow student musicians.', true)
on conflict (slug) do nothing;
