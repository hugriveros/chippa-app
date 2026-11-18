-- Chippa · Supabase schema
-- Run in the Supabase SQL editor. Only publishable/anon keys belong in the browser.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  avatar text not null default '🌷',
  created_at timestamptz not null default now()
);

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  date date not null,
  place text not null check (char_length(place) between 1 and 120),
  description text not null default '',
  emoji text not null default '💫',
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.experience_participants (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (experience_id, user_id)
);

create table if not exists public.experience_invitations (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Shared data has only content intentionally shared by the participants.
create table if not exists public.experience_state (
  experience_id uuid primary key references public.experiences(id) on delete cascade,
  shared_data jsonb not null default '{"shared":{"memories":[],"songs":[],"plans":[],"missions":[],"stamps":[],"game":{"sameIndex":0,"storyIndex":0,"triviaIndex":0}}}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Private drafts and explicitly shared answers use separate tables because RLS
-- applies to rows, not columns. Companions can never select private_data.
create table if not exists public.participant_private_state (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  private_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (experience_id, user_id)
);
create table if not exists public.participant_shared_state (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  public_data jsonb not null default '{}'::jsonb,
  share_opt_in boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (experience_id, user_id)
);

-- Separate date locked letters so recipients cannot read the body before opening day.
create table if not exists public.future_letters (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 10000),
  open_at date not null,
  shared boolean not null default true,
  created_at timestamptz not null default now()
);

-- Private media metadata gates the matching object in the private Storage bucket.
create table if not exists public.media_assets (
  path text primary key,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists experience_participants_user_idx on public.experience_participants(user_id, joined_at desc);
create index if not exists participant_private_state_exp_idx on public.participant_private_state(experience_id);
create index if not exists participant_shared_state_exp_idx on public.participant_shared_state(experience_id);
create index if not exists future_letters_recipient_idx on public.future_letters(recipient_id, open_at);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.experiences, public.experience_participants,
  public.experience_invitations, public.experience_state,
  public.participant_private_state, public.participant_shared_state,
  public.future_letters, public.media_assets to authenticated;

alter table public.profiles enable row level security;
alter table public.experiences enable row level security;
alter table public.experience_participants enable row level security;
alter table public.experience_invitations enable row level security;
alter table public.experience_state enable row level security;
alter table public.participant_private_state enable row level security;
alter table public.participant_shared_state enable row level security;
alter table public.future_letters enable row level security;
alter table public.media_assets enable row level security;

create or replace function public.is_experience_participant(target_experience uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.experience_participants p
  where p.experience_id = target_experience and p.user_id = target_user
) $$;

create or replace function public.is_experience_creator(target_experience uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.experiences e
  where e.id = target_experience and e.created_by = auth.uid()
) $$;

-- Only publish a response projection after both members have submitted and opted in.
create or replace function public.is_share_projection_ready(p_experience_id uuid, p_owner_id uuid, p_public_data jsonb)
returns boolean language plpgsql stable security definer set search_path = public, extensions
as $$
declare
  partner_id uuid;
  own_private jsonb;
  partner_private jsonb;
  section_key text;
  item_key text;
  entry jsonb;
  has_shared_content boolean := false;
begin
  if (select count(*) from public.experience_participants where experience_id = p_experience_id) <> 2 then
    return false;
  end if;

  select user_id into partner_id from public.experience_participants
  where experience_id = p_experience_id and user_id <> p_owner_id limit 1;
  select private_data into own_private from public.participant_private_state
  where experience_id = p_experience_id and user_id = p_owner_id;
  select private_data into partner_private from public.participant_private_state
  where experience_id = p_experience_id and user_id = partner_id;
  own_private := coalesce(own_private, '{}'::jsonb);
  partner_private := coalesce(partner_private, '{}'::jsonb);

  if p_public_data ? 'moment' then
    has_shared_content := true;
    if own_private #>> '{moment,ready}' is distinct from 'true'
      or own_private #>> '{moment,share}' is distinct from 'true'
      or partner_private #>> '{moment,ready}' is distinct from 'true'
      or partner_private #>> '{moment,share}' is distinct from 'true' then
      return false;
    end if;
  end if;

  foreach section_key in array array['same','stories','trivia'] loop
    if p_public_data ? section_key then
      has_shared_content := true;
      for item_key in select jsonb_object_keys(coalesce(p_public_data -> section_key, '{}'::jsonb)) loop
        if (own_private -> section_key -> item_key ->> 'share') is distinct from 'true' then
          return false;
        end if;
        if (partner_private -> section_key -> item_key ->> 'share') is distinct from 'true' then
          return false;
        end if;
        if section_key = 'same' or section_key = 'trivia' then
          if own_private -> section_key -> item_key -> 'value' is null or partner_private -> section_key -> item_key -> 'value' is null then return false; end if;
        else
          if nullif(own_private -> section_key -> item_key ->> 'text', '') is null or nullif(partner_private -> section_key -> item_key ->> 'text', '') is null then return false; end if;
        end if;
      end loop;
    end if;
  end loop;

  if p_public_data ? 'preferences' then
    has_shared_content := true;
    if own_private #>> '{preferences,ready}' is distinct from 'true'
      or partner_private #>> '{preferences,ready}' is distinct from 'true' then return false; end if;
  end if;

  if p_public_data ? 'letters' then
    has_shared_content := true;
    for entry in select value from jsonb_array_elements(coalesce(p_public_data -> 'letters', '[]'::jsonb)) loop
      if not exists (
        select 1 from jsonb_array_elements(coalesce(own_private -> 'letters', '[]'::jsonb)) as own_items(value)
        where own_items.value ->> 'id' = entry ->> 'id' and own_items.value ->> 'shared' = 'true'
      ) then return false; end if;
    end loop;
  end if;

  if p_public_data ? 'questions' then
    has_shared_content := true;
    for entry in select value from jsonb_array_elements(coalesce(p_public_data -> 'questions', '[]'::jsonb)) loop
      if not exists (
        select 1 from jsonb_array_elements(coalesce(own_private -> 'questions', '[]'::jsonb)) as own_items(value)
        where own_items.value ->> 'id' = entry ->> 'id' and own_items.value ->> 'shared' = 'true'
      ) then return false; end if;
    end loop;
  end if;

  if p_public_data ? 'votes' then has_shared_content := true; end if;
  return has_shared_content;
end;
$$;

create or replace function public.refresh_experience_sharing(p_experience_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare participant record;
begin
  if not public.is_experience_participant(p_experience_id) then raise exception 'Not a participant'; end if;
  for participant in
    select user_id, public_data from public.participant_shared_state where experience_id = p_experience_id
  loop
    update public.participant_shared_state
    set share_opt_in = public.is_share_projection_ready(p_experience_id, participant.user_id, participant.public_data),
        updated_at = now()
    where experience_id = p_experience_id and user_id = participant.user_id;
  end loop;
end;
$$;

create or replace function public.is_media_shared_with_participant(p_experience_id uuid, p_owner_id uuid, p_path text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.participant_shared_state ps
    where ps.experience_id = p_experience_id and ps.user_id = p_owner_id
      and ps.share_opt_in = true and ps.public_data #>> '{moment,photo,path}' = p_path
  ) or exists (
    select 1
    from public.experience_state es,
      jsonb_array_elements(coalesce(es.shared_data #> '{shared,memories}', '[]'::jsonb)) as memory(value)
    where es.experience_id = p_experience_id and memory.value #>> '{photo,path}' = p_path
  );
$$;

drop policy if exists "Profiles visible to experience companions" on public.profiles;
create policy "Profiles visible to experience companions" on public.profiles
for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.experience_participants mine
    join public.experience_participants theirs using (experience_id)
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Participants read experiences" on public.experiences;
create policy "Participants read experiences" on public.experiences for select to authenticated using (public.is_experience_participant(id));
drop policy if exists "Creator creates experience" on public.experiences;
create policy "Creator creates experience" on public.experiences for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Creator updates experience" on public.experiences;
create policy "Creator updates experience" on public.experiences for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "Creator deletes experience" on public.experiences;
create policy "Creator deletes experience" on public.experiences for delete to authenticated using (created_by = auth.uid());

drop policy if exists "Participants read membership" on public.experience_participants;
create policy "Participants read membership" on public.experience_participants for select to authenticated using (public.is_experience_participant(experience_id));
drop policy if exists "Creator joins own experience" on public.experience_participants;
create policy "Creator joins own experience" on public.experience_participants for insert to authenticated with check (user_id = auth.uid() and public.is_experience_creator(experience_id));
drop policy if exists "Participants may leave" on public.experience_participants;
create policy "Participants may leave" on public.experience_participants for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Participants read shared experience state" on public.experience_state;
create policy "Participants read shared experience state" on public.experience_state for select to authenticated using (public.is_experience_participant(experience_id));
drop policy if exists "Participants create shared experience state" on public.experience_state;
create policy "Participants create shared experience state" on public.experience_state for insert to authenticated with check (public.is_experience_participant(experience_id));
drop policy if exists "Participants update shared experience state" on public.experience_state;
create policy "Participants update shared experience state" on public.experience_state for update to authenticated using (public.is_experience_participant(experience_id)) with check (public.is_experience_participant(experience_id));

drop policy if exists "Read own private participant state" on public.participant_private_state;
create policy "Read own private participant state" on public.participant_private_state for select to authenticated using (user_id = auth.uid() and public.is_experience_participant(experience_id));
drop policy if exists "Create own private participant state" on public.participant_private_state;
create policy "Create own private participant state" on public.participant_private_state for insert to authenticated with check (user_id = auth.uid() and public.is_experience_participant(experience_id));
drop policy if exists "Update own private participant state" on public.participant_private_state;
create policy "Update own private participant state" on public.participant_private_state for update to authenticated using (user_id = auth.uid() and public.is_experience_participant(experience_id)) with check (user_id = auth.uid() and public.is_experience_participant(experience_id));
drop policy if exists "Delete own private participant state" on public.participant_private_state;
create policy "Delete own private participant state" on public.participant_private_state for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Read consented shared participant state" on public.participant_shared_state;
create policy "Read consented shared participant state" on public.participant_shared_state for select to authenticated using (
  public.is_experience_participant(experience_id) and (user_id = auth.uid() or share_opt_in = true)
);
drop policy if exists "Create own shared participant state" on public.participant_shared_state;
create policy "Create own shared participant state" on public.participant_shared_state for insert to authenticated with check (user_id = auth.uid() and public.is_experience_participant(experience_id) and share_opt_in = false);
drop policy if exists "Update own shared participant state" on public.participant_shared_state;
create policy "Update own shared participant state" on public.participant_shared_state for update to authenticated using (user_id = auth.uid() and public.is_experience_participant(experience_id)) with check (user_id = auth.uid() and public.is_experience_participant(experience_id) and share_opt_in = false);
drop policy if exists "Delete own shared participant state" on public.participant_shared_state;
create policy "Delete own shared participant state" on public.participant_shared_state for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Sender or due recipient reads future letter" on public.future_letters;
create policy "Sender or due recipient reads future letter" on public.future_letters for select to authenticated using (
  public.is_experience_participant(experience_id) and (
    sender_id = auth.uid() or (recipient_id = auth.uid() and shared = true and open_at <= current_date)
  )
);
drop policy if exists "Participant sends own future letter" on public.future_letters;
create policy "Participant sends own future letter" on public.future_letters for insert to authenticated with check (
  sender_id = auth.uid() and public.is_experience_participant(experience_id) and public.is_experience_participant(experience_id, recipient_id)
);
drop policy if exists "Sender manages own future letter" on public.future_letters;
create policy "Sender manages own future letter" on public.future_letters for update to authenticated
using (sender_id = auth.uid() and public.is_experience_participant(experience_id))
with check (sender_id = auth.uid() and public.is_experience_participant(experience_id) and public.is_experience_participant(experience_id, recipient_id));
drop policy if exists "Sender deletes own future letter" on public.future_letters;
create policy "Sender deletes own future letter" on public.future_letters for delete to authenticated using (sender_id = auth.uid());

drop policy if exists "Owner or shared participant reads media metadata" on public.media_assets;
create policy "Owner or shared participant reads media metadata" on public.media_assets for select to authenticated using (
  owner_id = auth.uid() or (shared = true and public.is_experience_participant(experience_id)
    and public.is_media_shared_with_participant(experience_id, owner_id, path))
);
drop policy if exists "Owner creates media metadata" on public.media_assets;
create policy "Owner creates media metadata" on public.media_assets for insert to authenticated with check (owner_id = auth.uid() and public.is_experience_participant(experience_id));
drop policy if exists "Owner updates media sharing" on public.media_assets;
create policy "Owner updates media sharing" on public.media_assets for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Owner deletes media metadata" on public.media_assets;
create policy "Owner deletes media metadata" on public.media_assets for delete to authenticated using (owner_id = auth.uid());

create or replace function public.create_experience_invitation(p_experience_id uuid)
returns text language plpgsql security definer set search_path = public, extensions
as $$
declare invite_token text;
begin
  if not public.is_experience_participant(p_experience_id) then raise exception 'Not a participant'; end if;
  invite_token := encode(gen_random_bytes(24), 'hex');
  insert into public.experience_invitations(experience_id, created_by, token_hash)
  values (p_experience_id, auth.uid(), encode(digest(invite_token, 'sha256'), 'hex'));
  return invite_token;
end;
$$;

create or replace function public.accept_experience_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$
declare invitation public.experience_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into invitation from public.experience_invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and revoked_at is null and expires_at > now()
  for update;
  if invitation.id is null then raise exception 'Invitation is invalid, expired, or already used'; end if;
  if invitation.created_by = auth.uid() then raise exception 'The inviter cannot accept their own invitation'; end if;
  if (select count(*) from public.experience_participants where experience_id = invitation.experience_id) >= 2 then raise exception 'This experience already has two participants'; end if;
  insert into public.experience_participants(experience_id, user_id) values (invitation.experience_id, auth.uid()) on conflict do nothing;
  update public.experience_invitations set accepted_by = auth.uid(), accepted_at = now() where id = invitation.id;
  return invitation.experience_id;
end;
$$;

revoke all on function public.create_experience_invitation(uuid) from public, anon;
revoke all on function public.accept_experience_invitation(text) from public, anon;
revoke all on function public.is_experience_participant(uuid, uuid) from public, anon;
revoke all on function public.is_experience_creator(uuid) from public, anon;
revoke all on function public.is_share_projection_ready(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.refresh_experience_sharing(uuid) from public, anon;
revoke all on function public.is_media_shared_with_participant(uuid, uuid, text) from public, anon;
grant execute on function public.create_experience_invitation(uuid) to authenticated;
grant execute on function public.accept_experience_invitation(text) to authenticated;
grant execute on function public.is_experience_participant(uuid, uuid) to authenticated;
grant execute on function public.is_experience_creator(uuid) to authenticated;
grant execute on function public.refresh_experience_sharing(uuid) to authenticated;
grant execute on function public.is_media_shared_with_participant(uuid, uuid, text) to authenticated;

-- Create this private Storage bucket in the dashboard, then enable these policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chippa-private', 'chippa-private', false, 4194304, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = 4194304;

drop policy if exists "Upload own Chippa media" on storage.objects;
create policy "Upload own Chippa media" on storage.objects for insert to authenticated with check (
  bucket_id = 'chippa-private' and (storage.foldername(name))[2] = auth.uid()::text
);
drop policy if exists "Read own or consented Chippa media" on storage.objects;
create policy "Read own or consented Chippa media" on storage.objects for select to authenticated using (
  bucket_id = 'chippa-private' and (
    (storage.foldername(name))[2] = auth.uid()::text or exists (
      select 1 from public.media_assets m where m.path = name and m.shared = true
        and public.is_experience_participant(m.experience_id)
        and public.is_media_shared_with_participant(m.experience_id, m.owner_id, m.path)
    )
  )
);
drop policy if exists "Delete own Chippa media" on storage.objects;
create policy "Delete own Chippa media" on storage.objects for delete to authenticated using (
  bucket_id = 'chippa-private' and (storage.foldername(name))[2] = auth.uid()::text
);

-- Enable realtime notifications for collaborative shared content.
do $$ begin
  alter publication supabase_realtime add table public.experience_state;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.participant_shared_state;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.participant_private_state;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.experience_participants;
exception when duplicate_object then null; end $$;


-- FRIEND CONNECTIONS: invitations and encounters
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
