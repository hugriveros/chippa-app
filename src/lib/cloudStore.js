import { supabase } from './supabase.js';
import { localDateValue } from './format.js';
import { createEmptyState } from './friendsStore.js';

function stripPersonalState(state) {
  const { memberData, activeUserId, mode, ...shared } = state;
  delete shared.experienceArchives;
  delete shared.experienceOptions;
  if (shared.experience) {
    shared.experience = { ...shared.experience };
    delete shared.experience.invitationCode;
  }
  return shared;
}

function shareableProjection(member = {}) {
  const project = {};
  if (member.moment?.ready && member.moment?.share) project.moment = member.moment;
  const same = Object.fromEntries(Object.entries(member.same || {}).filter(([, answer]) => answer?.share));
  const stories = Object.fromEntries(Object.entries(member.stories || {}).filter(([, answer]) => answer?.share));
  const trivia = Object.fromEntries(Object.entries(member.trivia || {}).filter(([, answer]) => answer?.share));
  const letters = (member.letters || []).filter((letter) => letter.shared);
  const questions = (member.questions || []).filter((entry) => entry.shared);
  if (Object.keys(same).length) project.same = same;
  if (Object.keys(stories).length) project.stories = stories;
  if (Object.keys(trivia).length) project.trivia = trivia;
  if (letters.length) project.letters = letters;
  if (questions.length) project.questions = questions;
  if (member.preferences?.ready) project.preferences = member.preferences;
  if (Object.keys(member.votes || {}).length) project.votes = member.votes;
  return project;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUp({ name, email, password, avatar }) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { name, avatar } }
  });
  if (error) throw error;
  if (data.user && data.session) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id, name, avatar
    });
    if (profileError) throw profileError;
  }
  return data.session ? data.user : null;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function ensureProfile(user) {
  const fallbackName = user.user_metadata?.name || user.email?.split('@')[0] || 'Chippa';
  const avatar = user.user_metadata?.avatar || '🌷';
  const { error } = await supabase.from('profiles').upsert({
    id: user.id, name: fallbackName, avatar
  }, { onConflict: 'id' });
  if (error) throw error;
}

export async function loadCloudState(user, requestedExperienceId) {
  await ensureProfile(user);
  const { data: memberships, error: membershipError } = await supabase
    .from('experience_participants')
    .select('experience_id, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });
  if (membershipError) throw membershipError;
  if (!memberships?.length) return createEmptyState({ id: user.id, name: user.user_metadata?.name || 'Mi perfil', avatar: user.user_metadata?.avatar || '/assets/chippa/memory-ticket-1.png' }, 'cloud');
  const experienceIds = memberships.map((membership) => membership.experience_id);
  const experienceId = experienceIds.includes(requestedExperienceId) ? requestedExperienceId : experienceIds[0];
  const { data: experienceOptions, error: optionsError } = await supabase.from('experiences')
    .select('id, title, date, place, emoji').in('id', experienceIds).order('date', { ascending: false });
  if (optionsError) throw optionsError;
  const [{ data: experience, error: experienceError }, { data: common, error: commonError }, { data: members, error: membersError }, { data: privateRows, error: privateError }, { data: publicRows, error: publicError }] = await Promise.all([
    supabase.from('experiences').select('*').eq('id', experienceId).single(),
    supabase.from('experience_state').select('shared_data').eq('experience_id', experienceId).maybeSingle(),
    supabase.from('experience_participants').select('user_id').eq('experience_id', experienceId),
    supabase.from('participant_private_state').select('user_id, private_data').eq('experience_id', experienceId),
    supabase.from('participant_shared_state').select('user_id, public_data, share_opt_in').eq('experience_id', experienceId)
  ]);
  for (const error of [experienceError, commonError, membersError, privateError, publicError]) if (error) throw error;

  const ids = (members || []).map((item) => item.user_id);
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, name, avatar').in('id', ids);
  if (profileError) throw profileError;
  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  const memberData = Object.fromEntries(ids.map((id) => [id, { moment: {}, same: {}, stories: {}, trivia: {}, letters: [], questions: [], future: [], preferences: {}, votes: {} }]));
  for (const row of privateRows || []) memberData[row.user_id] = row.private_data || {};
  for (const row of publicRows || []) if (row.user_id !== user.id && row.share_opt_in) memberData[row.user_id] = row.public_data || {};

  const commonData = common?.shared_data || {};
  return {
    ...commonData,
    mode: 'cloud',
    experience: {
      ...experience,
      createdBy: experience.created_by,
      invitationCode: experience.invitation_code,
      invitationAccepted: members?.length > 1
    },
    participants: ids.map((id) => ({ id, name: profileById[id]?.name || 'Acompañante', avatar: profileById[id]?.avatar || '⭐' })),
    activeUserId: user.id,
    memberData,
    experienceOptions: experienceOptions || [],
    shared: commonData.shared || { memories: [], songs: [], plans: [], missions: [], stamps: [], letterHistory: [], favorites: [], game: { sameIndex: 0, storyIndex: 0, triviaIndex: 0 } }
  };
}

async function saveSharedExperience(state, userId, previousMemories) {
  const experienceId = state.experience.id;
  const snapshot = stripPersonalState(state);
  const before = new Map(previousMemories.filter((memory) => memory.ownerId === userId).map((memory) => [memory.id, memory]));
  const after = new Map((state.shared?.memories || []).filter((memory) => memory.ownerId === userId).map((memory) => [memory.id, memory]));
  const deleted = new Set([...before.keys()].filter((id) => !after.has(id)));
  const changed = new Map([...after].filter(([id, memory]) => JSON.stringify(before.get(id)) !== JSON.stringify(memory)));

  // Retry if the other participant saves after we read the row. Only apply this author's edits.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: remote, error: readError } = await supabase.from('experience_state')
      .select('shared_data, updated_at').eq('experience_id', experienceId).maybeSingle();
    if (readError) throw readError;

    const retained = (remote?.shared_data?.shared?.memories || []).filter((memory) =>
      memory.ownerId !== userId || (!deleted.has(memory.id) && !changed.has(memory.id))
    );
    const memories = [...changed.values(), ...retained];
    const sharedData = { ...snapshot, shared: { ...snapshot.shared, memories } };
    const previousTime = remote ? Date.parse(remote.updated_at) || 0 : 0;
    const updatedAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
    const write = remote
      ? supabase.from('experience_state').update({ shared_data: sharedData, updated_at: updatedAt })
        .eq('experience_id', experienceId).eq('updated_at', remote.updated_at)
      : supabase.from('experience_state').upsert({
        experience_id: experienceId, shared_data: sharedData, updated_at: updatedAt
      }, { onConflict: 'experience_id', ignoreDuplicates: true });
    const { data: written, error: writeError } = await write.select('experience_id').maybeSingle();
    if (writeError) throw writeError;
    if (written) return;
  }
  throw new Error('La salida está recibiendo otros cambios. Vuelve a intentar la sincronización.');
}

export async function saveCloudState(state, userId, previousMemories = [], onSharedSaved) {
  if (!state.experience?.id || !userId) return;
  await saveSharedExperience(state, userId, previousMemories);
  onSharedSaved?.();

  const own = state.memberData?.[userId] || {};
  const publicData = shareableProjection(own);
  const { error: privateError } = await supabase.from('participant_private_state').upsert({
    experience_id: state.experience.id,
    user_id: userId,
    private_data: own,
    updated_at: new Date().toISOString()
  }, { onConflict: 'experience_id,user_id' });
  if (privateError) throw privateError;
  const { error: publicError } = await supabase.from('participant_shared_state').upsert({
    experience_id: state.experience.id,
    user_id: userId,
    public_data: publicData,
    share_opt_in: false,
    updated_at: new Date().toISOString()
  }, { onConflict: 'experience_id,user_id' });
  if (publicError) throw publicError;
  const { error: sharingError } = await supabase.rpc('refresh_experience_sharing', { p_experience_id: state.experience.id });
  if (sharingError) throw sharingError;
}

export function cloudSnapshotSignature(state, userId) {
  const ownData = state.memberData?.[userId] || {};
  return JSON.stringify({ shared: stripPersonalState(state), ownData });
}

export async function createCloudExperience(form, friendId) {
  const { data, error } = await supabase.rpc('create_friend_experience', { p_friend_id: friendId || null, p_title: form.title.trim(), p_date: form.date || localDateValue(), p_place: form.place, p_description: form.description || '', p_emoji: form.emoji || '\u2726' });
  if (error) throw error;
  return { id: data };
}

export async function joinCloudExperience(userId, token) {
  const { data, error } = await supabase.rpc('accept_experience_invitation', { p_token: token });
  if (error) throw error;
  return data;
}

export async function makeCloudInvitation(experienceId) {
  const { data, error } = await supabase.rpc('create_experience_invitation', { p_experience_id: experienceId });
  if (error) throw error;
  return data;
}

export async function leaveCloudExperience(experienceId, userId) {
  const { error } = await supabase.from('experience_participants')
    .delete().eq('experience_id', experienceId).eq('user_id', userId);
  if (error) throw error;
}

export async function uploadExperiencePhoto(file, experienceId, userId) {
  if (file.size > 4 * 1024 * 1024) throw new Error('La foto debe pesar menos de 4 MB.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${experienceId}/${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('chippa-private').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { error: metadataError } = await supabase.from('media_assets').insert({ path, experience_id: experienceId, owner_id: userId, shared: false });
  if (metadataError) {
    await supabase.storage.from('chippa-private').remove([path]);
    throw metadataError;
  }
  return { path };
}

export async function setExperiencePhotoShared(path, shared) {
  if (!path) return;
  const { error } = await supabase.from('media_assets').update({ shared }).eq('path', path);
  if (error) throw error;
}

export async function getExperiencePhotoUrl(path) {
  if (!path) return '';
  const { data, error } = await supabase.storage.from('chippa-private').createSignedUrl(path, 3600);
  if (error) return '';
  return data.signedUrl;
}

export async function createCloudFutureLetter({ experienceId, senderId, recipientId, title, body, openAt }) {
  const { data, error } = await supabase.from('future_letters').insert({
    experience_id: experienceId,
    sender_id: senderId,
    recipient_id: recipientId,
    title,
    body,
    open_at: openAt,
    shared: true
  }).select('id, experience_id, sender_id, recipient_id, title, body, open_at, created_at').single();
  if (error) throw error;
  return data;
}

export async function loadCloudFutureLetters(experienceId) {
  const { data, error } = await supabase.from('future_letters')
    .select('id, experience_id, sender_id, recipient_id, title, body, open_at, created_at')
    .eq('experience_id', experienceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

