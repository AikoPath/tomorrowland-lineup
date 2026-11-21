-- Two inserts at the same time each counted the rows before the other insert. Thus a user could go past 1000 rows.
-- This function is the function of 20261121000000_favourites_limit_existing_key.sql, with a lock before the count.

create or replace function public.limit_favourites() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  -- Inserts for the same user wait for each other until the end of the transaction. Thus the count is correct.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  if exists (select 1 from public.favourites where user_id = new.user_id and set_key = new.set_key) then
    return new;
  end if;
  if (select count(*) from public.favourites where user_id = new.user_id) >= 1000 then
    raise exception 'A user can have 1000 favourites only.';
  end if;
  return new;
end;
$$;
