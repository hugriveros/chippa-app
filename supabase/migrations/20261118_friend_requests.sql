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

create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id, created_at desc);
create index if not exists friend_requests_sender_idx on public.friend_requests(sender_id, created_at desc);
create unique index if not exists friend_requests_pending_pair_idx on public.friend_requests(sender_id,recipient_id) where status='pending';

alter table public.friend_requests enable row level security;
alter table public.friend_requests replica identity full;
grant select(id,owner_id,recipient_label,created_at,expires_at,accepted_at,accepted_by,revoked_at) on public.friend_invitations to authenticated;
grant select on public.friend_requests to authenticated;

drop policy if exists "Participants read friend requests" on public.friend_requests;
create policy "Participants read friend requests" on public.friend_requests
  for select to authenticated using (auth.uid() in (sender_id,recipient_id));

drop policy if exists "Profiles visible in friend requests" on public.profiles;
create policy "Profiles visible in friend requests" on public.profiles
  for select to authenticated using (exists (
    select 1 from public.friend_requests r
    where (r.sender_id=auth.uid() and r.recipient_id=profiles.id)
       or (r.recipient_id=auth.uid() and r.sender_id=profiles.id)
  ));

do $$ begin
  alter publication supabase_realtime add table public.friend_requests;
exception when duplicate_object then null; end $$;

create or replace function public.receive_friend_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare
  invitation public.friend_invitations%rowtype;
  request_id uuid;
  request_recipient uuid;
  request_status text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para recibir la solicitud.'; end if;
  select * into invitation
  from public.friend_invitations
  where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex')
  for update;
  if not found then raise exception 'La invitación no está disponible o ya venció.'; end if;
  if invitation.owner_id=auth.uid() then raise exception 'Este enlace es tuyo. Compártelo con la persona que quieres agregar.'; end if;

  select id,recipient_id,status into request_id,request_recipient,request_status
  from public.friend_requests where invitation_id=invitation.id;
  if found then
    if request_recipient=auth.uid() and request_status='pending' then return request_id; end if;
    if request_recipient=auth.uid() and request_status='accepted' then raise exception 'Ya están conectados como amigos.'; end if;
    if request_recipient=auth.uid() then raise exception 'Esta solicitud ya fue rechazada.'; end if;
    raise exception 'Este enlace ya fue utilizado.';
  end if;
  if invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at <= now() then
    raise exception 'La invitación no está disponible o ya venció.';
  end if;
  if exists (
    select 1 from public.friendships
    where user_a=least(invitation.owner_id,auth.uid()) and user_b=greatest(invitation.owner_id,auth.uid())
  ) then raise exception 'Ya están conectados como amigos.'; end if;

  insert into public.friend_requests(sender_id,recipient_id,invitation_id)
  values(invitation.owner_id,auth.uid(),invitation.id)
  on conflict do nothing returning id into request_id;
  if request_id is null then
    select id into request_id from public.friend_requests
    where sender_id=invitation.owner_id and recipient_id=auth.uid() and status='pending';
  end if;
  if request_id is null then raise exception 'No pudimos crear la solicitud. Pídele a tu amigo un enlace nuevo.'; end if;

  update public.friend_invitations set accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;
  return request_id;
end; $$;

create or replace function public.respond_friend_request(p_request_id uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare request_row public.friend_requests%rowtype; a uuid; b uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para responder la solicitud.'; end if;
  select * into request_row from public.friend_requests
  where id=p_request_id and recipient_id=auth.uid() for update;
  if not found or request_row.status <> 'pending' then raise exception 'Esta solicitud ya fue respondida o no está disponible.'; end if;
  if p_accept then
    a := least(request_row.sender_id,request_row.recipient_id);
    b := greatest(request_row.sender_id,request_row.recipient_id);
    insert into public.friendships(user_a,user_b) values(a,b) on conflict(user_a,user_b) do nothing;
    update public.friend_requests set status='accepted',responded_at=now() where id=request_row.id;
  else
    update public.friend_requests set status='declined',responded_at=now() where id=request_row.id;
  end if;
  return request_row.sender_id;
end; $$;

drop function if exists public.accept_friend_invitation(text);
revoke all on function public.receive_friend_invitation(text),public.respond_friend_request(uuid,boolean) from public,anon;
grant execute on function public.receive_friend_invitation(text),public.respond_friend_request(uuid,boolean) to authenticated;
