create or replace function public.create_friend_experience(p_friend_id uuid,p_title text,p_date date,p_place text,p_description text default '',p_emoji text default '💫')
returns uuid language plpgsql security definer set search_path=public as $$
declare created_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para crear una salida.'; end if;
  if p_friend_id is not null then
    if p_friend_id = auth.uid() then raise exception 'Elige otro perfil para invitar.'; end if;
    if not exists(select 1 from public.friendships where user_a=least(auth.uid(),p_friend_id) and user_b=greatest(auth.uid(),p_friend_id)) then raise exception 'Primero deben conectar como amigos.'; end if;
  end if;
  insert into public.experiences(title,date,place,description,emoji,created_by)
  values(trim(p_title),p_date,trim(p_place),p_description,p_emoji,auth.uid())
  returning id into created_id;
  insert into public.experience_participants(experience_id,user_id) values(created_id,auth.uid());
  if p_friend_id is not null then
    insert into public.experience_participants(experience_id,user_id) values(created_id,p_friend_id);
  end if;
  insert into public.experience_state(experience_id) values(created_id);
  return created_id;
end; $$;
