-- FR-20/24/70–73: built-in communities and persistent space follows.
-- Student-created communities still require a creator; built-ins do not need
-- a fabricated Auth account or ownership by whichever teammate migrates first.
alter table public.spaces add column is_seeded boolean not null default false;
alter table public.spaces drop constraint spaces_authorship;
alter table public.spaces add constraint spaces_authorship
    check (kind <> 'community' or created_by is not null or is_seeded);

insert into public.spaces (kind, slug, name, description, is_seeded) values
    ('community', 'study_groups', 'Study Groups', 'Find study partners, share resources, and prepare for exams together.', true),
    ('community', 'campus_events', 'Campus Events', 'Discover what is happening around Texas State.', true),
    ('community', 'gaming', 'Gaming', 'Find teammates and talk games with fellow Bobcats.', true),
    ('community', 'art', 'Art', 'Share your work, find inspiration, and meet student artists.', true),
    ('community', 'san_marcos_life', 'San Marcos Life', 'Explore local spots and everyday life in San Marcos.', true),
    ('community', 'technology', 'Technology', 'Discuss technology, programming, and projects.', true),
    ('community', 'cooking', 'Cooking', 'Swap recipes, cooking tips, and student-friendly meals.', true),
    ('community', 'sports', 'Sports', 'Talk Bobcat sports, intramurals, and pickup games.', true)
on conflict (slug) do nothing;

-- Writes go through FastAPI's verified-account gate. Keep existing read policy.
drop policy if exists follows_write_own on public.follows;

-- Keep counts correct for retries, concurrent follows, and profile deletion.
update public.spaces s set follower_count = (
    select count(*) from public.follows f where f.space_id = s.id
);
create function public.update_space_follower_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'INSERT' then
        update public.spaces set follower_count = follower_count + 1 where id = new.space_id;
        return new;
    end if;
    update public.spaces set follower_count = greatest(follower_count - 1, 0) where id = old.space_id;
    return old;
end;
$$;
create trigger follows_update_count after insert or delete on public.follows
    for each row execute function public.update_space_follower_count();
