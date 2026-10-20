-- Sticker Shelf schema. Run once in Supabase → SQL Editor.
create table public.artists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  aliases text[] not null default '{}',
  avatar_path text,
  avatar_bytes integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  artist_id uuid references public.artists on delete set null,
  title text not null,
  tags text[] not null default '{}',
  photo_path text,
  thumb_path text,
  photo_bytes integer not null default 0,
  image_hash text,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  order_date date,
  shop text,
  currency text not null default 'SGD',
  shipping_minor bigint not null default 0,
  total_minor bigint,
  sgd_paid_minor bigint,
  estimated boolean not null default false,
  is_unknown boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index orders_one_unknown_per_owner on public.orders (owner) where is_unknown;

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  sheet_id uuid not null references public.sheets on delete cascade,
  quantity integer not null check (quantity >= 1),
  price_minor bigint,
  estimated boolean not null default false
);

create table public.usages (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  sheet_id uuid not null references public.sheets on delete cascade,
  quantity integer not null check (quantity >= 1),
  used_on date not null default current_date
);

create table public.share_links (
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  token text not null unique,
  enabled boolean not null default false
);

-- Row-level security: each signed-in user sees only their own rows; anonymous sees nothing.
do $$
declare t text;
begin
  foreach t in array array['artists','sheets','orders','order_lines','usages','share_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

-- Share link: returns ONLY id, title, artist, thumbnail path. Never prices, orders or shops.
create or replace function public.shared_collection(p_token text)
returns table (sheet_id uuid, title text, artist text, thumb_path text)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, a.name, s.thumb_path
  from public.share_links l
  join public.sheets s on s.owner = l.owner
  left join public.artists a on a.id = s.artist_id
  where l.token = p_token and l.enabled
    and (select coalesce(sum(ol.quantity), 0) from public.order_lines ol where ol.sheet_id = s.id)
      > (select coalesce(sum(u.quantity), 0) from public.usages u where u.sheet_id = s.id)
  order by s.created_at desc;
$$;
revoke all on function public.shared_collection(text) from public;
grant execute on function public.shared_collection(text) to anon, authenticated;

-- Keep-alive target for the weekly GitHub Action.
create or replace function public.ping() returns integer language sql stable as $$ select 1 $$;
grant execute on function public.ping() to anon;

-- Photo storage: private full photos, public thumbnails (unguessable paths).
insert into storage.buckets (id, name, public) values ('photos', 'photos', false), ('thumbs', 'thumbs', true)
on conflict (id) do nothing;

create policy own_files on storage.objects for all to authenticated
  using (bucket_id in ('photos', 'thumbs') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('photos', 'thumbs') and (storage.foldername(name))[1] = auth.uid()::text);

-- Grant table privileges to anon/authenticated (RLS still enforces row access).
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant all on all routines in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;

