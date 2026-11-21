-- The trigger runs before "on conflict do nothing". Thus at the limit, the add of a key that the user already has failed.
-- Such a row does not make a new row, so the trigger accepts it.

create or replace function public.limit_favourites() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if exists (select 1 from public.favourites where user_id = new.user_id and set_key = new.set_key) then
    return new;
  end if;
  if (select count(*) from public.favourites where user_id = new.user_id) >= 1000 then
    raise exception 'A user can have 1000 favourites only.';
  end if;
  return new;
end;
$$;
