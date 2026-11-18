-- Run after schema.sql for an existing CHIPPA installation.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_a,user_b), check(user_a < user_b)
);
create table if not exists public.friend_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text unique not null,
  recipient_label text not null default '' check(char_length(recipient_label) <= 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  invitation_id uuid unique references public.friend_invitations(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);
do $$ begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.friend_requests;
exception when duplicate_object then null; end $$;
create index if not exists friendships_peer_idx on public.friendships(user_b);
create index if not exists friend_invites_owner_idx on public.friend_invitations(owner_id);
create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id, created_at desc);
create index if not exists friend_requests_sender_idx on public.friend_requests(sender_id, created_at desc);
create unique index if not exists friend_requests_pending_pair_idx on public.friend_requests(sender_id,recipient_id) where status='pending';
-- Existing accepted encounter memberships already represent a connection.
insert into public.friendships(user_a,user_b)
select distinct a.user_id,b.user_id from public.experience_participants a
join public.experience_participants b on b.experience_id=a.experience_id and a.user_id < b.user_id
on conflict(user_a,user_b) do nothing;
alter table public.friendships enable row level security;
alter table public.friend_invitations enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friend_requests replica identity full;
grant select on public.friendships to authenticated;
grant select on public.friend_requests to authenticated;
drop policy if exists "Friends read own connections" on public.friendships;
create policy "Friends read own connections" on public.friendships for select to authenticated using(auth.uid() in (user_a,user_b));
drop policy if exists "Participants read friend requests" on public.friend_requests;
create policy "Participants read friend requests" on public.friend_requests for select to authenticated using(auth.uid() in (sender_id,recipient_id));
drop policy if exists "Friends read connected profiles" on public.profiles;
create policy "Friends read connected profiles" on public.profiles for select to authenticated using(exists(select 1 from public.friendships f where (f.user_a=auth.uid() and f.user_b=profiles.id) or (f.user_b=auth.uid() and f.user_a=profiles.id)));
drop policy if exists "Profiles visible in friend requests" on public.profiles;
create policy "Profiles visible in friend requests" on public.profiles for select to authenticated using(exists(select 1 from public.friend_requests r where (r.sender_id=auth.uid() and r.recipient_id=profiles.id) or (r.recipient_id=auth.uid() and r.sender_id=profiles.id)));

create or replace function public.search_friend_profiles(p_query text)
returns table(profile_id uuid, profile_name text, profile_avatar text)
language plpgsql stable security definer set search_path=public as $$
declare search_text text := trim(coalesce(p_query, ''));
begin
  if auth.uid() is null then raise exception 'Inicia sesión para buscar perfiles.'; end if;
  if char_length(search_text) < 2 then raise exception 'Escribe al menos 2 caracteres para buscar.'; end if;
  if char_length(search_text) > 60 then raise exception 'La búsqueda no puede superar 60 caracteres.'; end if;
  return query
  select p.id, p.name, p.avatar from public.profiles p
  where p.id <> auth.uid() and strpos(lower(p.name), lower(search_text)) > 0
  order by lower(p.name), p.id limit 20;
end; $$;

create or replace function public.send_friend_request(p_recipient_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller_id uuid := auth.uid(); existing_id uuid; existing_sender uuid; request_id uuid;
begin
  if caller_id is null then raise exception 'Inicia sesión para enviar una solicitud.'; end if;
  if p_recipient_id is null or p_recipient_id = caller_id then raise exception 'Elige otro perfil para agregar.'; end if;
  if not exists(select 1 from public.profiles where id = p_recipient_id) then raise exception 'No encontramos ese perfil.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(caller_id::text, p_recipient_id::text) || ':' || greatest(caller_id::text, p_recipient_id::text), 0));
  if exists(select 1 from public.friendships where user_a = least(caller_id, p_recipient_id) and user_b = greatest(caller_id, p_recipient_id)) then raise exception 'Ya son amigos.'; end if;
  select r.id, r.sender_id into existing_id, existing_sender
  from public.friend_requests r
  where r.status = 'pending' and ((r.sender_id = caller_id and r.recipient_id = p_recipient_id) or (r.sender_id = p_recipient_id and r.recipient_id = caller_id))
  order by r.created_at desc limit 1 for update;
  if existing_id is not null then
    if existing_sender = caller_id then return existing_id; end if;
    raise exception 'Esta persona ya te envió una solicitud. Revísala en tu bandeja.';
  end if;
  begin
    insert into public.friend_requests(sender_id, recipient_id, status) values (caller_id, p_recipient_id, 'pending') returning id into request_id;
  exception when unique_violation then
    select r.id into request_id from public.friend_requests r where r.sender_id = caller_id and r.recipient_id = p_recipient_id and r.status = 'pending';
    if request_id is null then raise; end if;
  end;
  return request_id;
end; $$;

create or replace function public.respond_friend_request(p_request_id uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare request_row public.friend_requests%rowtype; a uuid; b uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para responder la solicitud.'; end if;
  select * into request_row from public.friend_requests where id=p_request_id and recipient_id=auth.uid() for update;
  if not found or request_row.status <> 'pending' then raise exception 'Esta solicitud ya fue respondida o no está disponible.'; end if;
  if p_accept then
    a := least(request_row.sender_id,request_row.recipient_id); b := greatest(request_row.sender_id,request_row.recipient_id);
    insert into public.friendships(user_a,user_b) values(a,b) on conflict(user_a,user_b) do nothing;
    update public.friend_requests set status='accepted',responded_at=now() where id=request_row.id;
  else
    update public.friend_requests set status='declined',responded_at=now() where id=request_row.id;
  end if;
  return request_row.sender_id;
end; $$;
create or replace function public.create_friend_experience(p_friend_id uuid,p_title text,p_date date,p_place text,p_description text default '',p_emoji text default '💫')
returns uuid language plpgsql security definer set search_path=public as $$
declare created_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para crear un encuentro.'; end if;
  if not exists(select 1 from public.friendships where user_a=least(auth.uid(),p_friend_id) and user_b=greatest(auth.uid(),p_friend_id)) then raise exception 'Primero deben conectar como amigos.'; end if;
  insert into public.experiences(title,date,place,description,emoji,created_by) values(trim(p_title),p_date,trim(p_place),p_description,p_emoji,auth.uid()) returning id into created_id;
  insert into public.experience_participants(experience_id,user_id) values(created_id,auth.uid()),(created_id,p_friend_id);
  insert into public.experience_state(experience_id) values(created_id);
  return created_id;
end; $$;
drop function if exists public.accept_friend_invitation(text);
revoke select(id,owner_id,recipient_label,created_at,expires_at,accepted_at,accepted_by,revoked_at) on public.friend_invitations from authenticated;
revoke all on table public.friend_invitations from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_invitations') then
    alter publication supabase_realtime drop table public.friend_invitations;
  end if;
end $$;
revoke all on function public.respond_friend_request(uuid,boolean),public.create_friend_experience(uuid,text,date,text,text,text),public.search_friend_profiles(text),public.send_friend_request(uuid) from public,anon;
grant execute on function public.respond_friend_request(uuid,boolean),public.create_friend_experience(uuid,text,date,text,text,text),public.search_friend_profiles(text),public.send_friend_request(uuid) to authenticated;
