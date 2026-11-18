do $$ begin
  alter publication supabase_realtime add table public.participant_private_state;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.friend_invitations;
exception when duplicate_object then null; end $$;
