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

revoke all on function public.search_friend_profiles(text), public.send_friend_request(uuid) from public, anon;
grant execute on function public.search_friend_profiles(text), public.send_friend_request(uuid) to authenticated;

drop function if exists public.create_friend_invitation(text), public.receive_friend_invitation(text), public.revoke_friend_invitation(uuid);
revoke select(id,owner_id,recipient_label,created_at,expires_at,accepted_at,accepted_by,revoked_at) on public.friend_invitations from authenticated;
revoke all on table public.friend_invitations from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_invitations') then
    alter publication supabase_realtime drop table public.friend_invitations;
  end if;
end $$;
