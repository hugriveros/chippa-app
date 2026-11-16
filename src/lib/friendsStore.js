import { supabase } from './supabase.js';
import { avatars, sameQuestions, triviaQuestions, storyPrompts } from '../data.js';

const localKey = 'chippa-friends-v1';
const uuid = () => crypto.randomUUID();
const read = () => { try { return JSON.parse(localStorage.getItem(localKey)) || { connections: [], invitations: [] }; } catch { return { connections: [], invitations: [] }; } };
const write = (value) => localStorage.setItem(localKey, JSON.stringify(value));
export const emptyShared = () => ({ memories: [], songs: [], plans: [], missions: [], stamps: [], letterHistory: [], favorites: [], game: { sameIndex: 0, storyIndex: 0, triviaIndex: 0 } });
export const emptyMemberData = () => ({ moment: {}, same: {}, stories: {}, trivia: {}, letters: [], questions: [], future: [], preferences: {}, votes: {} });
export function createEmptyState(person, mode = 'demo') {
  return { mode, experience: null, participants: [person], activeUserId: person.id, memberData: { [person.id]: emptyMemberData() }, experienceArchives: [], shared: emptyShared() };
}
export function localMeetings(state) {
  const entries = [...(state.experience?.id ? [{ experience: state.experience, participants: state.participants, memberData: state.memberData, shared: state.shared }] : []), ...(state.experienceArchives || [])];
  return entries.map((entry) => ({ ...entry, participants: entry.participants || Object.keys(entry.memberData || {}).map((id) => state.participants.find((person) => person.id === id) || { id, name: 'Amigo', avatar: avatars[1] }) }));
}
export async function loadFriends(person, state) {
  if (state.mode !== 'cloud') {
    const data = read();
    const meetings = localMeetings(state).filter((entry) => entry.participants.some((p) => p.id === person.id));
    // Preserve relationships that already existed in the local experience.
    for (const meeting of meetings.filter((entry) => entry.experience.invitationAccepted)) {
      for (const peer of meeting.participants.filter((entry) => entry.id !== person.id)) {
        if (!data.connections.some((entry) => entry.people.some((p) => p.id === person.id) && entry.people.some((p) => p.id === peer.id))) data.connections.push({ id: uuid(), people: [person, peer], createdAt: meeting.experience.date });
      }
    }
    write(data);
    return { connections: data.connections.filter((entry) => entry.people.some((p) => p.id === person.id)).map((entry) => ({ ...entry.people.find((p) => p.id !== person.id), connectedAt: entry.createdAt })), invitations: data.invitations.filter((entry) => entry.owner.id === person.id), meetings };
  }
  const [{ data: links, error }, { data: invites, error: inviteError }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.from('friendships').select('*'),
    supabase.from('friend_invitations').select('id, recipient_label, created_at, expires_at, accepted_at, revoked_at').eq('owner_id', person.id).order('created_at', { ascending: false }),
    supabase.from('experience_participants').select('experience_id').eq('user_id', person.id)
  ]);
  if (error || inviteError || membershipError) throw error || inviteError || membershipError;
  const peerIds = (links || []).map((entry) => entry.user_a === person.id ? entry.user_b : entry.user_a);
  const { data: profiles, error: profileError } = peerIds.length ? await supabase.from('profiles').select('id,name,avatar').in('id', peerIds) : { data: [] };
  if (profileError) throw profileError;
  const ids = (memberships || []).map((entry) => entry.experience_id);
  let meetings = [];
  if (ids.length) {
    const results = await Promise.all([
      supabase.from('experiences').select('*').in('id', ids).order('date', { ascending: false }),
      supabase.from('experience_participants').select('experience_id,user_id').in('experience_id', ids),
      supabase.from('experience_state').select('experience_id,shared_data').in('experience_id', ids),
      supabase.from('participant_shared_state').select('experience_id,user_id,public_data,share_opt_in').in('experience_id', ids)
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [experiences, participants, common, shared] = results.map((result) => result.data || []);
    meetings = experiences.map((experience) => ({ experience, participants: participants.filter((entry) => entry.experience_id === experience.id).map((entry) => [person, ...(profiles || [])].find((p) => p.id === entry.user_id) || { id: entry.user_id, name: 'Acompañante' }), shared: common.find((entry) => entry.experience_id === experience.id)?.shared_data?.shared || emptyShared(), memberData: Object.fromEntries(shared.filter((entry) => entry.experience_id === experience.id && entry.share_opt_in).map((entry) => [entry.user_id, entry.public_data])) }));
  }
  return { connections: profiles || [], invitations: (invites || []).map((entry) => ({ id: entry.id, label: entry.recipient_label, createdAt: entry.created_at, expiresAt: entry.expires_at, acceptedAt: entry.accepted_at, revokedAt: entry.revoked_at })), meetings };
}
export async function inviteFriend(person, mode, label) {
  if (mode === 'cloud') {
    const { data, error } = await supabase.rpc('create_friend_invitation', { p_label: label.trim() });
    if (error) throw error;
    return data;
  }
  const data = read();
  const token = uuid();
  data.invitations.unshift({ id: uuid(), token, owner: person, label: label.trim(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), acceptedAt: null });
  write(data); return token;
}
export async function acceptFriend(person, mode, input, simulate = false) {
  let token = input.trim();
  try { const link = new URL(token); token = link.searchParams.get('friend') || token; } catch { /* A code can be pasted directly. */ }
  if (mode === 'cloud') {
    const { data, error } = await supabase.rpc('accept_friend_invitation', { p_token: token });
    if (error) throw error;
    return data;
  }
  const data = read();
  const invite = data.invitations.find((entry) => entry.token === token || entry.id === token);
  if (!invite || invite.acceptedAt || invite.revokedAt || new Date(invite.expiresAt) <= new Date()) throw new Error('La invitación no está disponible o ya venció.');
  if (invite.owner.id === person.id && !simulate) throw new Error('Este enlace es tuyo. Compártelo con tu amigo para conectar.');
  const peer = simulate ? { id: `local-friend-${uuid()}`, name: invite.label || 'Mi amigo', avatar: avatars[1] } : person;
  if (!data.connections.some((entry) => entry.people.some((p) => p.id === invite.owner.id) && entry.people.some((p) => p.id === peer.id))) data.connections.push({ id: uuid(), people: [invite.owner, peer], createdAt: new Date().toISOString() });
  invite.acceptedAt = new Date().toISOString(); write(data);
  return peer.id;
}
export async function revokeFriendInvitation(person, mode, id) {
  if (mode === 'cloud') { const { error } = await supabase.rpc('revoke_friend_invitation', { p_id: id }); if (error) throw error; return; }
  const data = read(); const invite = data.invitations.find((entry) => entry.id === id && entry.owner.id === person.id); if (invite && !invite.acceptedAt) invite.revokedAt = new Date().toISOString(); write(data);
}

export function meetingsWithFriend(meetings, personId, friendId) {
  return meetings.filter((entry) => entry.participants.some((person) => person.id === personId) && entry.participants.some((person) => person.id === friendId)).sort((a,b) => b.experience.date.localeCompare(a.experience.date));
}
export function sharedInteractions(meeting) {
  const shared = meeting.shared || {};
  const entries = [
    ...(shared.memories || []).filter((entry) => entry.shared && entry.id !== 'memory-welcome').map((entry) => ({ id: entry.id, type: 'Recuerdo compartido', text: entry.text || 'Una fotografía', date: entry.createdAt })),
    ...(shared.songs || []).map((entry) => ({ id: entry.id, type: 'Canción', text: `${entry.title} · ${entry.artist}`, date: entry.createdAt })),
    ...(shared.plans || []).map((entry) => ({ id: `plan-${entry.title}`, type: 'Plan guardado', text: entry.title }))
  ];
  const members = meeting.memberData || {};
  for (const [field, label, prompts] of [['same','Coincidencias',sameQuestions],['trivia','Trivia',triviaQuestions],['stories','Historia',storyPrompts]]) {
    const indices = new Set(Object.values(members).flatMap((member) => Object.keys(member[field] || {})));
    for (const index of indices) {
      if (meeting.participants.length < 2 || !meeting.participants.every((person) => { const response = members[person.id]?.[field]?.[index]; return response?.share && Boolean(response.value || response.text); })) continue;
      const prompt = prompts[Number(index) % prompts.length];
      const responses = meeting.participants.map((person) => { const response = members[person.id][field][index]; return `${person.name}: ${response.value || response.text}`; });
      entries.push({ id: `${field}-${index}`, type: label, text: `${typeof prompt === 'string' ? prompt : prompt.q}\n${responses.join('\n')}` });
    }
  }
  for (const [id, member] of Object.entries(members)) {
    for (const entry of member.letters || []) if (entry.shared) entries.push({ id: `letter-${entry.id}`, type: 'Carta compartida', text: entry.response, date: entry.createdAt });
    for (const entry of member.questions || []) if (entry.shared) entries.push({ id: `question-${entry.id}`, type: 'Pregunta compartida', text: entry.answer, date: entry.createdAt });
    if (member.moment?.share && member.moment.ready && meeting.participants.length >= 2 && meeting.participants.every((p) => members[p.id]?.moment?.share && members[p.id]?.moment?.ready)) entries.push({ id: `moment-${id}`, type: 'Momento favorito', text: member.moment.favorite });
  }
  for (const [key,label] of [['sameFinished','Ronda de coincidencias'],['triviaFinished','Trivia completada'],['storyFinished','Historia completada']]) if (shared.game?.[key]) entries.push({ id: key, type: 'Juego', text: label });
  if (shared.game?.matchedPairs) entries.push({ id: 'memory-finished', type: 'Juego', text: 'Match de recuerdos completado' });
  return entries;
}
