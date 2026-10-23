-- FR-32: new posts keep at most four attachments (positions 0 through 3).
-- Preserve legacy attachments at higher positions, including worker updates
-- to their object keys. Enforce the new bound on insertion or repositioning.
create function public.check_post_media_image_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.position > 3 and (
        tg_op = 'INSERT' or new.position is distinct from old.position
        or new.post_id is distinct from old.post_id
    ) then
        raise exception 'Posts may contain at most four images (FR-32)'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;
create trigger post_media_four_images before insert or update of position, post_id
    on public.post_media for each row
    execute function public.check_post_media_image_limit();

-- The reservation endpoint locks the owner's profiles row before counting and
-- inserting. Include tombstones: deleting an upload must not reset rate limits.
create index image_uploads_owner_rate_idx
    on public.image_uploads (owner_id, created_at);
