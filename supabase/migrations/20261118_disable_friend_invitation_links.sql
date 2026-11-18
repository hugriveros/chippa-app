drop function if exists public.create_friend_invitation(text), public.receive_friend_invitation(text), public.revoke_friend_invitation(uuid);
revoke select(id,owner_id,recipient_label,created_at,expires_at,accepted_at,accepted_by,revoked_at) on public.friend_invitations from authenticated;
revoke all on table public.friend_invitations from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_invitations') then
    alter publication supabase_realtime drop table public.friend_invitations;
  end if;
end $$;
