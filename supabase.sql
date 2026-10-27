-- LOVE.exe database setup for Supabase (run the whole file in SQL Editor).
-- The game uses Supabase anonymous sign-in. Enable it in Authentication > Providers > Anonymous.

create table if not exists public.love_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null,
  guest_id uuid,
  host_name text not null check (char_length(host_name) between 1 and 24),
  guest_name text,
  level integer not null default 1 check (level between 1 and 5),
  question_index integer not null default 1 check (question_index between 1 and 10),
  answers jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guest_id is null or guest_id <> host_id),
  check ((guest_id is null and guest_name is null) or (guest_id is not null and guest_name is not null))
);

create index if not exists love_rooms_host_id_idx on public.love_rooms(host_id);
create index if not exists love_rooms_guest_id_idx on public.love_rooms(guest_id);
alter table public.love_rooms enable row level security;
-- No direct client inserts or updates. Only the validated RPC functions below can mutate rooms.
drop policy if exists "room members can view their room" on public.love_rooms;
create policy "room members can view their room" on public.love_rooms
for select to authenticated using (auth.uid() = host_id or auth.uid() = guest_id);
revoke insert, update, delete on public.love_rooms from anon, authenticated;
grant select on public.love_rooms to authenticated;

create or replace function public.love_create_room(p_code text, p_player_name text)
returns public.love_rooms language plpgsql security definer set search_path = public
as $$
declare r public.love_rooms;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_code !~ '^[A-Z0-9]{6}$' then raise exception 'Invalid room code.'; end if;
  if char_length(trim(p_player_name)) not between 1 and 24 then raise exception 'Player name must be 1–24 characters.'; end if;
  insert into public.love_rooms(code, host_id, host_name) values (p_code, auth.uid(), trim(p_player_name)) returning * into r;
  return r;
end; $$;

create or replace function public.love_join_room(p_code text, p_player_name text)
returns public.love_rooms language plpgsql security definer set search_path = public
as $$
declare r public.love_rooms;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if char_length(trim(p_player_name)) not between 1 and 24 then raise exception 'Player name must be 1–24 characters.'; end if;
  select * into r from public.love_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Room not found. Check the code and try again.'; end if;
  if r.host_id = auth.uid() or r.guest_id = auth.uid() then return r; end if;
  if r.guest_id is not null then raise exception 'This room already has two players.'; end if;
  update public.love_rooms set guest_id = auth.uid(), guest_name = trim(p_player_name), updated_at = now() where id = r.id returning * into r;
  return r;
end; $$;

create or replace function public.love_submit_answer(p_code text, p_level integer, p_question integer, p_answer text)
returns public.love_rooms language plpgsql security definer set search_path = public
as $$
declare r public.love_rooms; answer_path text[]; cleaned text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  cleaned := trim(coalesce(p_answer, ''));
  if char_length(cleaned) < 1 or char_length(cleaned) > 1200 then raise exception 'Answer must be 1–1200 characters.'; end if;
  select * into r from public.love_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Room not found.'; end if;
  if auth.uid() <> r.host_id and auth.uid() <> r.guest_id then raise exception 'You are not a member of this room.'; end if;
  if r.guest_id is null then raise exception 'Waiting for Player 2 to join.'; end if;
  if r.completed then raise exception 'This game is already complete.'; end if;
  if p_level <> r.level or p_question <> r.question_index then raise exception 'The game moved on. Refreshing your room should fix this.'; end if;
  answer_path := array[p_level::text, p_question::text, auth.uid()::text];
  if coalesce(r.answers #>> answer_path, '') <> '' then raise exception 'Your answer is already locked in.'; end if;
  -- jsonb_set does not create missing intermediate objects, so build each level explicitly.
  level_answers := coalesce(r.answers -> p_level::text, '{}'::jsonb);
  question_answers := coalesce(level_answers -> p_question::text, '{}'::jsonb);
  question_answers := jsonb_set(question_answers, array[auth.uid()::text], to_jsonb(cleaned), true);
  level_answers := jsonb_set(level_answers, array[p_question::text], question_answers, true);
  update public.love_rooms set answers = jsonb_set(answers, array[p_level::text], level_answers, true), updated_at = now() where id = r.id returning * into r;
  return r;
end; $$;

create or replace function public.love_advance(p_code text)
returns public.love_rooms language plpgsql security definer set search_path = public
as $$
declare r public.love_rooms; answer_row jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into r from public.love_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Room not found.'; end if;
  if auth.uid() <> r.host_id then raise exception 'Player 1 advances the shared game.'; end if;
  if r.completed then return r; end if;
  if r.guest_id is null then raise exception 'Waiting for Player 2.'; end if;
  answer_row := r.answers -> r.level::text -> r.question_index::text;
  if coalesce(answer_row ->> r.host_id::text, '') = '' or coalesce(answer_row ->> r.guest_id::text, '') = '' then
    raise exception 'Both players must answer before moving on.';
  end if;
  if r.question_index < 10 then
    update public.love_rooms set question_index = question_index + 1, updated_at = now() where id = r.id returning * into r;
  elsif r.level < 5 then
    update public.love_rooms set level = level + 1, question_index = 1, updated_at = now() where id = r.id returning * into r;
  else
    update public.love_rooms set completed = true, updated_at = now() where id = r.id returning * into r;
  end if;
  return r;
end; $$;

revoke all on function public.love_create_room(text,text) from public;
revoke all on function public.love_join_room(text,text) from public;
revoke all on function public.love_submit_answer(text,integer,integer,text) from public;
revoke all on function public.love_advance(text) from public;
grant execute on function public.love_create_room(text,text) to authenticated;
grant execute on function public.love_join_room(text,text) to authenticated;
grant execute on function public.love_submit_answer(text,integer,integer,text) to authenticated;
grant execute on function public.love_advance(text) to authenticated;

-- Enable realtime updates for the shared room row.
do $$ begin
  alter publication supabase_realtime add table public.love_rooms;
exception when duplicate_object then null;
when duplicate_table then null;
end $$;
