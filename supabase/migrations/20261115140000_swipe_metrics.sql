alter table public.mutirao_mentoria_swipe_items
add column if not exists likes integer not null default 0,
add column if not exists comments integer not null default 0,
add column if not exists shares integer not null default 0,
add column if not exists views integer not null default 0;
