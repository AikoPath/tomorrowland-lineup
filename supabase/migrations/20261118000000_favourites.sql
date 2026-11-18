-- The favourite sets of each user. The Supabase GitHub integration runs this migration after the merge to main.

create table public.favourites (
  -- The database sets the user from the session. The browser does not send it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The key from favouriteKey in src/favourites/favourites.ts, for example 2026-12-11/amelie-lens+charlotte-de-witte.
  set_key text not null check (set_key ~ '^\d{4}-\d{2}-\d{2}/[a-z0-9+-]{1,200}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, set_key)
);

-- The publishable key is public. Row level security lets each user read and change only their own rows.
alter table public.favourites enable row level security;

revoke all on public.favourites from anon;
revoke all on public.favourites from authenticated;
grant select, insert, delete on public.favourites to authenticated;

create policy "Users read their own favourites"
  on public.favourites for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add their own favourites"
  on public.favourites for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own favourites"
  on public.favourites for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The festival has fewer than 1000 sets. The limit stops a user who fills the database.
create function public.limit_favourites() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if (select count(*) from public.favourites where user_id = new.user_id) >= 1000 then
    raise exception 'A user can have 1000 favourites only.';
  end if;
  return new;
end;
$$;

create trigger limit_favourites
  before insert on public.favourites
  for each row execute function public.limit_favourites();
