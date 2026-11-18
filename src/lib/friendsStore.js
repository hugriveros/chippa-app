import { supabase } from './supabase.js';
import { avatars, sameQuestions, triviaQuestions, storyPrompts } from '../data.js';

const localKey = 'chippa-friends-v1';
const uuid = () => crypto.randomUUID();
const read = () => { try { const data = JSON.parse(localStorage.getItem(localKey)) || {}; return { connections: data.connections || [], invitations: data.invitations || [], requests: data.requests || [] }; } catch { return { connections: [], invitations: [], requests: [] }; } };
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
    const requests = data.requests.filter((entry) => entry.senderId === person.id || entry.recipientId === person.id).map((entry) => ({ ...entry, sender: entry.senderId === person.id ? person : entry.sender, recipient: entry.recipientId === person.id ? person : entry.recipient }));
    return { connections: data.connections.filter((entry) => entry.people.some((p) => p.id === person.id)).map((entry) => ({ ...entry.people.find((p) => p.id !== person.id), connectedAt: entry.createdAt })), invitations: data.invitations.filter((entry) => entry.owner.id === person.id), requests, meetings };
  }
  const [{ data: links, error }, { data: invites, error: inviteError }, { data: rows, error: requestError }, { data: memberships, error: membershipError }] = await Promise.all([
    supabase.from('friendships').select('*'),
    supabase.from('friend_invitations').select('id, recipient_label, created_at, expires_at, accepted_at, accepted_by, revoked_at').eq('owner_id', person.id).order('created_at', { ascending: false }),
    supabase.from('friend_requests').select('id, sender_id, recipient_id, invitation_id, status, created_at, responded_at').or(`sender_id.eq.${person.id},recipient_id.eq.${person.id}`).order('created_at', { ascending: false }),
    supabase.from('experience_participants').select('experience_id').eq('user_id', person.id)
  ]);
  if (error || inviteError || requestError || membershipError) throw error || inviteError || requestError || membershipError;
  const friendIds = (links || []).map((entry) => entry.user_a === person.id ? entry.user_b : entry.user_a);
  const peerIds = [...new Set([...friendIds, ...(rows || []).flatMap((entry) => [entry.sender_id, entry.recipient_id].filter((id) => id !== person.id)), ...(invites || []).map((entry) => entry.accepted_by).filter(Boolean)])];
  const { data: profiles, error: profileError } = peerIds.length ? await supabase.from('profiles').select('id,name,avatar').in('id', peerIds) : { data: [] };
  if (profileError) throw profileError;
  const profileById = new Map([[person.id, person], ...(profiles || []).map((profile) => [profile.id, profile])]);
  const requests = (rows || []).map((entry) => ({ id: entry.id, senderId: entry.sender_id, recipientId: entry.recipient_id, invitationId: entry.invitation_id, status: entry.status, createdAt: entry.created_at, respondedAt: entry.responded_at, sender: profileById.get(entry.sender_id) || { id: entry.sender_id, name: 'Perfil CHIPPA' }, recipient: profileById.get(entry.recipient_id) || { id: entry.recipient_id, name: 'Perfil CHIPPA' } }));
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
    meetings = experiences.map((experience) => ({ experience, participants: participants.filter((entry) => entry.experience_id === experience.id).map((entry) => profileById.get(entry.user_id) || { id: entry.user_id, name: 'Acompañante' }), shared: common.find((entry) => entry.experience_id === experience.id)?.shared_data?.shared || emptyShared(), memberData: Object.fromEntries(shared.filter((entry) => entry.experience_id === experience.id && entry.share_opt_in).map((entry) => [entry.user_id, entry.public_data])) }));
  }
  return { connections: friendIds.map((id) => profileById.get(id)).filter(Boolean), invitations: (invites || []).map((entry) => ({ id: entry.id, label: entry.recipient_label, createdAt: entry.created_at, expiresAt: entry.expires_at, acceptedAt: entry.accepted_at, acceptedBy: entry.accepted_by, revokedAt: entry.revoked_at, requestStatus: requests.find((request) => request.invitationId === entry.id)?.status || null })), requests, meetings };
}
export async function inviteFriend(person, mode, label) {
  if (mode === 'cloud') {
    const { data, error } = await supabase.rpc('create_friend_invitation', { p_label: String(label || '').trim() });
    if (error) throw error;
    return data;
  }
  const data = read();
  const token = uuid();
  data.invitations.unshift({ id: uuid(), token, owner: person, label: String(label || '').trim(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), acceptedAt: null, acceptedBy: null });
  write(data); return token;
}
export async function receiveFriendInvitation(person, mode, input) {
  let token = input.trim();
  try { const link = new URL(token); token = link.searchParams.get('friend') || token; } catch { /* A code can be pasted directly. */ }
  if (mode === 'cloud') {
    const { data, error } = await supabase.rpc('receive_friend_invitation', { p_token: token });
    if (error) throw error;
    return data;
  }
  const data = read();
  const invite = data.invitations.find((entry) => entry.token === token || entry.id === token);
  if (!invite) throw new Error('No encontramos ese enlace o código de invitación.');
  if (invite.owner.id === person.id) throw new Error('Este enlace es tuyo. Compártelo con la persona que quieres agregar.');
  const existing = data.requests.find((entry) => entry.invitationId === invite.id);
  if (existing) {
    if (existing.recipientId === person.id && existing.status === 'pending') return existing.id;
    if (existing.recipientId === person.id && existing.status === 'accepted') throw new Error('Ya están conectados como amigos.');
    if (existing.recipientId === person.id) throw new Error('Esta solicitud ya fue rechazada.');
    throw new Error('Este enlace ya fue utilizado. Pídele a tu amigo que cree uno nuevo.');
  }
  if (invite.acceptedAt || invite.revokedAt || new Date(invite.expiresAt) <= new Date()) throw new Error('La invitación no está disponible o ya venció.');
  if (data.connections.some((entry) => entry.people.some((peer) => peer.id === invite.owner.id) && entry.people.some((peer) => peer.id === person.id))) throw new Error('Ya están conectados como amigos.');
  const now = new Date().toISOString();
  let request = data.requests.find((entry) => entry.senderId === invite.owner.id && entry.recipientId === person.id && entry.status === 'pending');
  if (!request) {
    request = { id: uuid(), senderId: invite.owner.id, recipientId: person.id, invitationId: invite.id, status: 'pending', createdAt: now, respondedAt: null, sender: invite.owner, recipient: person };
    data.requests.unshift(request);
  }
  invite.acceptedAt = now;
  invite.acceptedBy = person.id;
  write(data);
  return request.id;
}
export async function respondFriendRequest(person, mode, id, accept) {
  if (mode === 'cloud') {
    const { error } = await supabase.rpc('respond_friend_request', { p_request_id: id, p_accept: accept });
    if (error) throw error;
    return;
  }
  const data = read();
  const request = data.requests.find((entry) => entry.id === id && entry.recipientId === person.id && entry.status === 'pending');
  if (!request) throw new Error('Esta solicitud ya fue respondida o no está disponible.');
  request.status = accept ? 'accepted' : 'declined';
  request.respondedAt = new Date().toISOString();
  if (accept && !data.connections.some((entry) => entry.people.some((peer) => peer.id === request.senderId) && entry.people.some((peer) => peer.id === person.id))) {
    data.connections.push({ id: uuid(), people: [request.sender, person], createdAt: request.respondedAt });
  }
  write(data);
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
