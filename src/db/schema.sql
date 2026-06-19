create table if not exists stores (
  id text primary key,            -- kanonický název: "Lidl", "Tesco", ...
  proximity int not null          -- pořadí blízkosti (1 = nejblíž)
);

create table if not exists offers (
  id bigint generated always as identity primary key,
  store_id text not null references stores(id),
  product_name text not null,
  is_club boolean not null default false,
  price numeric,                  -- dolní mez u rozsahu
  price_max numeric,              -- horní mez u rozsahu, jinak null
  category text,
  valid_from date,
  valid_to date,
  source text not null,
  source_url text not null,
  scraped_at timestamptz not null default now(),
  -- idempotence: stejný produkt/obchod/platnost/zdroj se neduplikuje
  unique (store_id, product_name, is_club, valid_to, source)
);

create index if not exists offers_store_idx on offers (store_id);
create index if not exists offers_valid_to_idx on offers (valid_to);

create table if not exists scrape_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  source text not null,
  status text not null,           -- "success" | "error"
  item_count int not null default 0,
  message text
);
