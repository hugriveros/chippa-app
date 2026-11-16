revoke all on function public.create_experience_invitation(uuid) from public, anon;
revoke all on function public.accept_experience_invitation(text) from public, anon;

grant execute on function public.create_experience_invitation(uuid) to authenticated;
grant execute on function public.accept_experience_invitation(text) to authenticated;
