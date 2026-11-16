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
create index if not exists friendships_peer_idx on public.friendships(user_b);
create index if not exists friend_invites_owner_idx on public.friend_invitations(owner_id);
-- Existing accepted encounter memberships already represent a connection.
insert into public.friendships(user_a,user_b)
select distinct a.user_id,b.user_id from public.experience_participants a
join public.experience_participants b on b.experience_id=a.experience_id and a.user_id < b.user_id
on conflict(user_a,user_b) do nothing;
alter table public.friendships enable row level security;
alter table public.friend_invitations enable row level security;
grant select on public.friendships to authenticated;
grant select(id,owner_id,recipient_label,created_at,expires_at,accepted_at,revoked_at) on public.friend_invitations to authenticated;
drop policy if exists "Friends read own connections" on public.friendships;
create policy "Friends read own connections" on public.friendships for select to authenticated using(auth.uid() in (user_a,user_b));
drop policy if exists "Owners read friend invitations" on public.friend_invitations;
create policy "Owners read friend invitations" on public.friend_invitations for select to authenticated using(owner_id=auth.uid());
drop policy if exists "Friends read connected profiles" on public.profiles;
create policy "Friends read connected profiles" on public.profiles for select to authenticated using(exists(select 1 from public.friendships f where (f.user_a=auth.uid() and f.user_b=profiles.id) or (f.user_b=auth.uid() and f.user_a=profiles.id)));

create or replace function public.create_friend_invitation(p_label text default '')
returns text language plpgsql security definer set search_path=public,extensions as $$
declare token text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para invitar.'; end if;
  if char_length(trim(p_label)) > 60 then raise exception 'Usa un nombre de hasta 60 caracteres.'; end if;
  token := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.friend_invitations(owner_id,token_hash,recipient_label) values(auth.uid(),encode(extensions.digest(token,'sha256'),'hex'),trim(p_label));
  return token;
end; $$;
create or replace function public.accept_friend_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare invitation public.friend_invitations; a uuid; b uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para conectar.'; end if;
  select * into invitation from public.friend_invitations where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
  if not found or invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at <= now() then raise exception 'La invitación no está disponible o ya venció.'; end if;
  if invitation.owner_id=auth.uid() then raise exception 'No puedes aceptar tu propia invitación.'; end if;
  a := least(invitation.owner_id,auth.uid()); b := greatest(invitation.owner_id,auth.uid());
  insert into public.friendships(user_a,user_b) values(a,b) on conflict(user_a,user_b) do nothing;
  update public.friend_invitations set accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;
  return invitation.owner_id;
end; $$;
create or replace function public.revoke_friend_invitation(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  update public.friend_invitations set revoked_at=now() where id=p_id and owner_id=auth.uid() and accepted_at is null;
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
revoke all on function public.create_friend_invitation(text),public.accept_friend_invitation(text),public.revoke_friend_invitation(uuid),public.create_friend_experience(uuid,text,date,text,text,text) from public,anon;
grant execute on function public.create_friend_invitation(text),public.accept_friend_invitation(text),public.revoke_friend_invitation(uuid),public.create_friend_experience(uuid,text,date,text,text,text) to authenticated;
