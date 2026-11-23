import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  avatars, avatarOptions, modules
} from './data.js';
import { loadDemoState, resetDemoState, saveDemoState } from './lib/demoStore.js';
import { supabaseConfigured, supabase } from './lib/supabase.js';
import {
  createCloudExperience, ensureProfile, joinCloudExperience, loadCloudState,
  leaveCloudExperience, signIn, signOut, signUp
} from './lib/cloudStore.js';
import ExperienceModule from './ExperienceModule.jsx';
import { labelDate } from './lib/format.js';
import { LegalFooter, LegalPolicies } from './LegalPolicies.jsx';
import GamesHub, { ActivityCard } from './GamesHub.jsx';
import Avatar from './Avatar.jsx';
import FriendsPage, { Empty as EmptyFriends } from './FriendsPage.jsx';
import { createEmptyState, emptyShared, loadFriends } from './lib/friendsStore.js';
import { useAppState } from './context/AppStateContext.jsx';
import PremiumCheckout from './PremiumCheckout.jsx';
import OutingForm from './OutingForm.jsx';
import { activityStatus, completionRecord, loadSimulatedPremium, premiumKey } from './lib/activityStatus.js';

const groupOrder = ['Revive la cita', 'Juegos', 'Cartas', 'Aventuras', 'Conózcanse', 'Guarden recuerdos'];
const emptyMember = () => ({ moment: {}, same: {}, stories: {}, trivia: {}, letters: [], questions: [], future: [], preferences: {}, votes: {} });
const navigationItems = [
  { target: 'dashboard', label: 'Inicio', icon: 'home' },
  { target: 'outings', label: 'Salidas', icon: 'outings' },
  { target: 'friends', label: 'Amigos', icon: 'friends' },
  { target: 'capsule', label: 'Cápsulas', icon: 'capsule' },
  { target: 'passport', label: 'Pasaporte', icon: 'passport' }
];
const outingPages = ['outing-detail', 'games', 'module', 'results'];

function ExperienceMark({ value, fallback = '💫' }) {
  const mark = value || fallback;
  return typeof mark === 'string' && mark.startsWith('/assets/chippa/')
    ? <img className="experience-mark-image" src={mark} alt="" />
    : mark;
}

function SidebarIcon({ name }) {
  const artwork = {
    home: <><path d="m8 19 12-10 12 10v11H8V19Z" fill="white" /><path d="M16 30v-7h8v7" fill="#FEE7F2" /><path d="m20 16 1.1 1.2 1.3-.3-.6 1.2.6 1.2-1.3-.3-1.1 1.2-.1-1.3-1.2-.7 1.2-.7.1-1.3Z" fill="#E91577" /></>,
    outings: <><rect x="8" y="10" width="24" height="22" rx="5" fill="white" /><path d="M14 7v6M26 7v6M9 16h22" stroke="#8A42BD" strokeWidth="2" strokeLinecap="round" /><path d="M14 21h4M22 21h4M14 26h4" stroke="#D41470" strokeWidth="2" strokeLinecap="round" /><path d="m27 22 .8 1.7 1.9.3-1.4 1.3.3 1.9-1.6-.9-1.7.9.3-1.9-1.4-1.3 1.9-.3.9-1.7Z" fill="#F2B532" /></>,
    friends: <><circle cx="15" cy="15" r="5" fill="white" /><circle cx="27" cy="16" r="4" fill="#FFE7F2" /><path d="M6 31c.7-5.1 4-8 9-8s8.3 2.9 9 8" fill="white" /><path d="M23 24c4.5-.8 8.2 1.8 9 6" stroke="white" strokeWidth="2.3" strokeLinecap="round" /><path d="m26 9 .8 1.4 1.6.3-1.2 1.1.2 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.3.7-1.4Z" fill="#FFD23F" /></>,
    moment: <><path d="M10 7h19a3 3 0 0 1 3 3v21H13a3 3 0 0 1-3-3V7Z" fill="white" /><path d="M14 12h13M14 17h11M14 22h8" stroke="#B60D65" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 8v19a4 4 0 0 0 4 4" stroke="#FFD23F" strokeWidth="2.3" strokeLinecap="round" /><path d="m27 25 .8 1.5 1.7.3-1.2 1.2.2 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.3.8-1.5Z" fill="#8A42BD" /></>,
    games: <><path d="M12 13h16a6 6 0 0 1 5.7 7.8l-1.8 5.6a3 3 0 0 1-4.8 1.3l-3-2.3h-8.2l-3 2.3a3 3 0 0 1-4.8-1.3l-1.8-5.6A6 6 0 0 1 12 13Z" fill="white" /><path d="M13 18v6M10 21h6" stroke="#B60D65" strokeWidth="2.2" strokeLinecap="round" /><circle cx="27" cy="19" r="1.8" fill="#F08B3E" /><circle cx="30" cy="23" r="1.8" fill="#8550C5" /><path d="m21 10 1 2" stroke="#FFD23F" strokeWidth="2.5" strokeLinecap="round" /></>,
    letters: <><path d="M8 12a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V12Z" fill="white" /><path d="m9 13 11 8 11-8" stroke="#A22AA0" strokeWidth="2" strokeLinejoin="round" /><path d="m20 25-.8-.7c-2.5-2.2-4.2-3.7-4.2-5.5a2.8 2.8 0 0 1 5-1.7 2.8 2.8 0 0 1 5 1.7c0 1.8-1.7 3.3-4.2 5.5l-.8.7Z" fill="#E91577" stroke="white" strokeWidth=".8" /></>,
    adventures: <><path d="m7 11 9-4 8 4 9-4v22l-9 4-8-4-9 4V11Z" fill="white" /><path d="M16 7v22M24 11v22" stroke="#AD68CE" strokeWidth="1.7" /><path d="M11 23c3-5 5 3 8-2s4 1 8-5" stroke="#159EC5" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2" /><path d="M27 11c0 2.5-3 5.5-3 5.5S21 13.5 21 11a3 3 0 1 1 6 0Z" fill="#E91577" /><circle cx="24" cy="11" r="1" fill="white" /></>,
    results: <><path d="M8 10a4 4 0 0 1 4-4h17a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H17l-7 5v-5.6a4 4 0 0 1-2-3.4V10Z" fill="white" /><circle cx="15" cy="15.5" r="1.5" fill="#E91577" /><circle cx="20.5" cy="15.5" r="1.5" fill="#8A42BD" /><circle cx="26" cy="15.5" r="1.5" fill="#159EC5" /><path d="M14 20h12" stroke="#C7A6D7" strokeWidth="1.5" strokeLinecap="round" /><path d="m9 7 1 .3.5 1 .5-1L12 7l-1-.6-.5-1-.5 1-1 .6Z" fill="#FFD23F" /></>,
    capsule: <><path d="M7 13a4 4 0 0 1 4-4h4l2-2h6l2 2h4a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V13Z" fill="white" /><circle cx="20" cy="20" r="7" fill="#BDEBF4" stroke="#803FB5" strokeWidth="2" /><circle cx="20" cy="20" r="3.4" fill="#E91577" /><path d="M12 12h3" stroke="#FFD23F" strokeWidth="2" strokeLinecap="round" /><path d="m28 8 .7 1.3L30 10l-1.3.7L28 12l-.7-1.3L26 10l1.3-.7L28 8Z" fill="#FFD23F" /></>,
    passport: <><path d="M12 7h16a3 3 0 0 1 3 3v21H14a4 4 0 0 1-4-4V9a2 2 0 0 1 2-2Z" fill="white" /><path d="M14 7v24" stroke="#FFD23F" strokeWidth="2" /><circle cx="22" cy="18" r="5.5" fill="#F8E5F2" stroke="#B32E88" strokeWidth="1.5" /><path d="m19 18 2 2 4-5" stroke="#7A43BA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M18 27h9" stroke="#B32E88" strokeWidth="1.5" strokeLinecap="round" /></>
  };
  return <span className={`sidebar-icon-box sidebar-icon-${name}`} aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false">{artwork[name]}</svg></span>;
}

function HomeQuickIcon({ name }) {
  const artwork = {
    outings: <><rect x="8" y="10" width="24" height="22" rx="5" fill="#fff" stroke="#284a60" strokeWidth="2" /><path d="M14 7v6M26 7v6M9 16h22" stroke="#1686f5" strokeWidth="2.5" strokeLinecap="round" /><path d="M14 21h4M22 21h4M14 26h4" stroke="#284a60" strokeWidth="2" strokeLinecap="round" /><circle cx="28" cy="25" r="2.2" fill="#f2bd3f" /></>,
    friends: <><circle cx="13" cy="14" r="4" fill="#f2bd3f" stroke="#fff" strokeWidth="1.5" /><circle cx="25" cy="13" r="4" fill="#38a2b2" stroke="#fff" strokeWidth="1.5" /><path d="M5 31c.6-5 3.4-8 8-8s7.4 3 8 8v2H5v-2Z" fill="#fff" stroke="#284a60" strokeWidth="1.5" /><path d="M19 31c.5-5 2.8-8 6-8 4.5 0 7.3 3 8 8v2H19v-2Z" fill="#d9ecff" stroke="#284a60" strokeWidth="1.5" /><path d="m31 7 .8 1.6 1.7.3-1.2 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.2-1.2 1.7-.3.8-1.6Z" fill="#f2bd3f" /></>,
    capsule: <><rect x="6" y="12" width="28" height="20" rx="5" fill="#fff" stroke="#284a60" strokeWidth="2" /><path d="m12 12 2-4h7l2 4" fill="#f2bd3f" stroke="#284a60" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="21" cy="22" r="7" fill="#d9ecff" stroke="#1686f5" strokeWidth="2.5" /><circle cx="21" cy="22" r="3.5" fill="#e91577" /><circle cx="29" cy="17" r="1.5" fill="#64ad43" /></>,
    passport: <><path d="M11 6h17a3 3 0 0 1 3 3v23H14a4 4 0 0 1-4-4V8a2 2 0 0 1 1-2Z" fill="#1686f5" stroke="#284a60" strokeWidth="1.5" /><path d="M14 7v24" stroke="#f2bd3f" strokeWidth="3" /><circle cx="23" cy="18" r="6" fill="#fff" stroke="#f2bd3f" strokeWidth="1.5" /><path d="M18 18h10M23 12c-3 3-3 9 0 12m0-12c3 3 3 9 0 12" fill="none" stroke="#167c80" strokeWidth="1.2" strokeLinecap="round" /><path d="M18 27h9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></>
  };
  if (!artwork[name]) return <SidebarIcon name={name} />;
  return <svg className="home-quick-svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false">{artwork[name]}</svg>;
}

function App() {
  const localPreview = import.meta.env.DEV && !supabaseConfigured;
  const [page, setPage] = useState('welcome');
  const [moduleId, setModuleId] = useState('moment');
  const [activityReturnPage, setActivityReturnPage] = useState('dashboard');
  const { state, setState, update, updateMember, setCloudUser, hydrateCloudState, syncError, clearSyncError } = useAppState();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [authMode, setAuthMode] = useState('signup');
  const [busy, setBusy] = useState(false);
  const [openingExperienceId, setOpeningExperienceId] = useState('');
  const [toast, setToast] = useState('');
  const [legalDocument, setLegalDocument] = useState(null);
  const [premiumItem, setPremiumItem] = useState(null);
  const [premiumActive, setPremiumActive] = useState(false);
  const [gamesFilter, setGamesFilter] = useState('Todos');
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [social, setSocial] = useState({ connections: [], requests: [], meetings: [] });
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [meetingFriend, setMeetingFriend] = useState(null);
  const [friendsVersion, setFriendsVersion] = useState(0);
  const friendsLoadVersion = useRef(0);
  const inviteHandled = useRef(false);

  const acceptPendingInvite = useCallback(async (authUser) => {
    const code = new URLSearchParams(window.location.search).get('invite');
    if (!code || inviteHandled.current) return;
    inviteHandled.current = true;
    await ensureProfile(authUser);
    await joinCloudExperience(authUser.id, code);
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => { setCloudUser(user); }, [user, setCloudUser]);

  useEffect(() => {
    if (!syncError) return;
    notify(syncError);
    clearSyncError();
  }, [syncError, notify, clearSyncError]);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    let alive = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) notify('No pudimos revisar tu sesión. Intenta iniciar sesión.');
      if (data.session?.user) {
        setUser(data.session.user);
        try {
          const loaded = await loadCloudState(data.session.user);
          if (!alive) return;
          if (loaded) hydrateCloudState(loaded, data.session.user);
          setPage('dashboard');
        } catch (loadError) { notify(loadError.message || 'No pudimos cargar tus experiencias.'); setPage('welcome'); }
      }
      if (alive) setAuthReady(true);
    }).catch(() => { if (alive) { setAuthReady(true); notify('No pudimos conectar tu cuenta. Puedes volver a iniciar sesión.'); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (!session?.user) { setUser(null); setCloudUser(null); setState(null); setPage('welcome'); return; }
      setUser(session.user);
      window.setTimeout(async () => {
        try {
          await acceptPendingInvite(session.user);
          const loaded = await loadCloudState(session.user);
          if (!alive) return;
          if (loaded) hydrateCloudState(loaded, session.user);
          setPage('dashboard');
        } catch (error) { notify(error.message || 'No pudimos abrir esta invitación.'); setPage('friends'); }
      }, 0);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [notify, acceptPendingInvite, hydrateCloudState, setCloudUser]);

  const currentUser = useMemo(() => state?.participants?.find((person) => person.id === state.activeUserId) || state?.participants?.[0], [state]);
  const partner = useMemo(() => state?.participants?.find((person) => person.id !== currentUser?.id), [state, currentUser]);
  const currentMember = state?.memberData?.[state?.activeUserId] || emptyMember();
  const outingEntries = useMemo(() => {
    if (!state) return [];
    const entries = state.mode === 'cloud'
      ? [...(state.experienceOptions || []), ...(state.experience?.id ? [state.experience] : [])]
      : [...(state.experience?.id ? [state.experience] : []), ...(state.experienceArchives || []).map((entry) => entry.experience)];
    return [...new Map(entries.filter((entry) => entry?.id).map((entry) => [entry.id, entry])).values()]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [state]);
  const socialContext = useRef({ currentUser, state });
  socialContext.current = { currentUser, state };

  const premiumIdentity = state?.mode === 'cloud' ? user?.id : currentUser?.id;
  useEffect(() => {
    const refresh = () => setPremiumActive(premiumIdentity ? loadSimulatedPremium(premiumIdentity) : false);
    refresh(); window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [premiumIdentity]);

  useEffect(() => {
    if (!state?.experience?.id || !currentUser) return;
    const pending = modules.filter((item) => activityStatus(state, item.id) && !currentMember.completedActivities?.[item.id]).map((item) => item.id);
    if (pending.length) updateMember((member) => completionRecord(member, pending));
  }, [state, currentUser?.id, updateMember]);

  const activatePremium = () => {
    if (!premiumIdentity) throw new Error('Abre tu perfil antes de activar Premium.');
    localStorage.setItem(premiumKey(premiumIdentity), JSON.stringify({ status: 'active', simulated: true, activatedAt: new Date().toISOString() }));
    setPremiumActive(true);
    const pending = premiumItem;
    setPremiumItem(null);
    if (modules.some((item) => item.id === pending?.id)) { setModuleId(pending.id); setPage('module'); }
    notify('Premium activado con pago simulado.');
  };
  const cancelPremium = () => {
    localStorage.removeItem(premiumKey(premiumIdentity)); setPremiumActive(false); setPremiumItem(null); setPage('dashboard');
    notify('Plan Free activo. Tus recuerdos siguen guardados.');
  };

  const refreshFriends = useCallback(async () => {
    const { currentUser: activeUser, state: activeState } = socialContext.current;
    if (!activeUser || !activeState) return;
    const requestVersion = ++friendsLoadVersion.current;
    setFriendsLoading(true); setFriendsError('');
    try {
      const result = await loadFriends(activeUser, activeState);
      if (requestVersion === friendsLoadVersion.current && socialContext.current.currentUser?.id === activeUser.id) setSocial({ ...result, ownerId: activeUser.id });
      return result;
    } catch (error) {
      if (requestVersion === friendsLoadVersion.current) setFriendsError('No pudimos cargar tus amigos. Intenta nuevamente.');
      throw error;
    } finally { if (requestVersion === friendsLoadVersion.current) setFriendsLoading(false); }
  }, []);
  useEffect(() => {
    if (!currentUser || !state) { friendsLoadVersion.current += 1; setSocial({ connections: [], requests: [], meetings: [] }); setFriendsLoading(false); return undefined; }
    let active = true;
    const requestVersion = ++friendsLoadVersion.current;
    setFriendsLoading(true);
    const loadSocial = async () => {
      try {
        const result = await loadFriends(currentUser, state);
        if (active && requestVersion === friendsLoadVersion.current) { setSocial({ ...result, ownerId: currentUser.id }); setFriendsError(''); }
      } catch (loadError) {
        if (active && requestVersion === friendsLoadVersion.current) setFriendsError(loadError.message || 'No pudimos cargar tus amigos. Intenta nuevamente.');
      } finally { if (active && requestVersion === friendsLoadVersion.current) setFriendsLoading(false); }
    };
    loadSocial();
    return () => { active = false; };
  }, [currentUser?.id, state?.mode, state?.experience?.id, friendsVersion]);
  useEffect(() => {
    if (!currentUser || !state) return undefined;
    const refresh = () => { if (!document.hidden) refreshFriends().catch(() => {}); };
    window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const channel = state.mode === 'cloud' && supabase ? supabase.channel(`chippa-friend-requests-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `recipient_id=eq.${currentUser.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${currentUser.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_a=eq.${currentUser.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_b=eq.${currentUser.id}` }, refresh)
      .subscribe() : null;
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); if (channel) supabase.removeChannel(channel); };
  }, [currentUser?.id, state?.mode, refreshFriends]);
  const newMeetingWith = (friend) => { setMeetingFriend(friend); setShowExperienceForm(true); };
  const openNewOuting = () => { setMeetingFriend(null); setShowExperienceForm(true); };
  const closeOutingForm = () => { setShowExperienceForm(false); setMeetingFriend(null); };
  const outingFriends = social.ownerId === currentUser?.id ? social.connections || [] : [];

  const startLocalPreview = () => {
    setCloudUser(null);
    const demo = loadDemoState();
    saveDemoState(demo);
    setState(demo);
    setPage('dashboard');
    notify('Tu espacio está listo en este dispositivo.');
  };

  const handleAuth = async (form) => {
    if (!supabaseConfigured) {
      if (import.meta.env.PROD) { notify('El acceso a CHIPPA todavía se está preparando.'); return; }
      const next = authMode === 'login' ? loadDemoState() : createEmptyState({ id: `local-${crypto.randomUUID()}`, name: form.name.trim(), avatar: form.avatar || avatars[0] });
      setCloudUser(null); setState(next); saveDemoState(next); setPage('dashboard');
      return;
    }
    setBusy(true);
    try {
      const authUser = authMode === 'signup'
        ? await signUp(form)
        : await signIn(form.email, form.password);
      if (!authUser) { notify('Revisa tu correo para confirmar tu cuenta y luego inicia sesión.'); setPage('auth'); }
      else {
        setUser(authUser);
        await acceptPendingInvite(authUser);
        const loaded = await loadCloudState(authUser);
        if (loaded) hydrateCloudState(loaded, authUser);
        setPage('dashboard');
      }
    } catch (error) { notify(error.message || 'No pudimos continuar. Revisa tus datos.'); }
    finally { setBusy(false); }
  };

  const createExperience = async (form) => {
    const { friendId, ...experienceForm } = form;
    const selectedFriend = friendId
      ? outingFriends.find((person) => person.id === friendId) || (meetingFriend?.id === friendId ? meetingFriend : null)
      : null;
    if (friendId && !selectedFriend) throw new Error('Ese amigo ya no está disponible. Elige a otra persona o crea la salida para ti.');
    if (state?.mode === 'cloud' || (!state && user && supabaseConfigured)) {
      setBusy(true);
      let created;
      try {
        created = await createCloudExperience(experienceForm, selectedFriend?.id || null);
        const loaded = await loadCloudState(user, created.id);
        if (loaded?.experience?.id !== created.id) throw new Error('No pudimos abrir la nueva salida.');
        hydrateCloudState(loaded, user);
        closeOutingForm();
        setPage('dashboard');
        notify(selectedFriend ? `Salida creada con ${selectedFriend.name}.` : 'Salida creada para ti.');
      } catch (error) {
        if (!created) throw error;
        update((current) => current ? ({
          ...current,
          experienceOptions: [...(current.experienceOptions || []), { ...experienceForm, id: created.id }]
        }) : current);
        closeOutingForm();
        setPage('outings');
        notify('La salida se guardó. Puedes abrirla desde Mis salidas.');
      }
      finally { setBusy(false); }
      return;
    }
    const experience = { ...experienceForm, id: `demo-${Date.now()}`, status: 'active', createdBy: state?.activeUserId, invitationAccepted: Boolean(selectedFriend) };
    update((previous) => {
      const archive = previous.experience?.title ? [{ experience: previous.experience, memberData: previous.memberData, shared: previous.shared, participants: previous.participants }] : [];
      const people = selectedFriend ? [currentUser, selectedFriend] : [currentUser];
      const newMembers = Object.fromEntries(people.map((person) => [person.id, emptyMember()]));
      return {
        ...previous,
        experience,
        participants: people,
        activeUserId: currentUser.id,
        memberData: newMembers,
        experienceArchives: [...archive, ...(previous.experienceArchives || [])],
        shared: { ...emptyShared(), stamps: [experienceForm.place] }
      };
    });
    closeOutingForm();
    setPage('dashboard');
    notify(selectedFriend ? `Salida creada con ${selectedFriend.name}.` : 'Salida creada para ti.');
  };

  const selectExperience = async (experienceId) => {
    const requestedId = String(experienceId ?? '');
    if (!requestedId || openingExperienceId) return;
    if (String(state.experience?.id ?? '') === requestedId) {
      setPage('outing-detail');
      return;
    }
    if (state.mode === 'cloud') {
      setOpeningExperienceId(requestedId);
      let timeoutId;
      try {
        if (!user?.id) throw new Error('Inicia sesión nuevamente para abrir esta salida.');
        const selected = await Promise.race([
          loadCloudState(user, requestedId),
          new Promise((_, reject) => { timeoutId = window.setTimeout(() => reject(new Error('La salida está tardando demasiado. Comprueba tu conexión e intenta otra vez.')), 15000); })
        ]);
        if (String(selected?.experience?.id ?? '') !== requestedId) throw new Error('No encontramos esa salida en tu cuenta. Actualiza la lista e intenta otra vez.');
        hydrateCloudState(selected, user);
        setPage('outing-detail');
      }
      catch (error) { notify(error.message || 'No pudimos abrir esa salida.'); }
      finally { window.clearTimeout(timeoutId); setOpeningExperienceId(''); }
      return;
    }
    const selected = (state.experienceArchives || []).find((entry) => String(entry?.experience?.id || '') === requestedId);
    if (!selected) { notify('No encontramos esa salida guardada. Actualiza la lista e intenta otra vez.'); return; }
    setState((previous) => {
      const archives = previous.experienceArchives || [];
      const previousOuting = previous.experience?.id ? { experience: previous.experience, memberData: previous.memberData, shared: previous.shared, participants: previous.participants } : null;
      const rest = archives.filter((entry) => String(entry?.experience?.id || '') !== requestedId);
      return { ...previous, ...selected, participants: selected.participants || previous.participants, experienceArchives: [...(previousOuting ? [previousOuting] : []), ...rest] };
    });
    setPage('outing-detail');
  };


  const logout = async () => {
    if (state?.mode === 'demo') {
      setCloudUser(null); setState(null); setPage('welcome');
      return;
    }
    try { await signOut(); } catch (error) { notify(error.message || 'No se pudo cerrar sesión.'); }
  };

  const resetLocalPreview = () => {
    if (!window.confirm('¿Borrar el espacio guardado en este dispositivo?')) return;
    const fresh = resetDemoState(); setState(fresh); setPage('dashboard'); setProfileMenu(false); notify('Espacio restablecido.');
  };

  const leaveExperience = async () => {
    if (!window.confirm('¿Salir de esta experiencia compartida? Tus borradores privados dejarán de aparecer en este espacio.')) return;
    setProfileMenu(false);
    if (state.mode === 'demo') {
      update((previous) => ({ ...previous, experience: { ...previous.experience, invitationAccepted: false } }));
      notify('Saliste de este encuentro. Puedes volver a invitar a tu acompañante.');
      return;
    }
    try {
      await leaveCloudExperience(state.experience.id, user.id);
      const next = await loadCloudState(user);
      if (next) { hydrateCloudState(next, user); setPage('dashboard'); }
      else { setState(null); setPage('outings'); }
      notify('Saliste de esta experiencia.');
    } catch (error) { notify(error.message || 'No pudimos salir de la experiencia.'); }
  };

  const showPremiumNotice = (id) => setPremiumItem(modules.find((item) => item.id === id) || { id: 'subscription', title: 'CHIPPA Premium' });
  const changePage = (next) => {
    if (next === 'friends') setFriendsVersion((version) => version + 1);
    if (!state.experience?.id && !['friends','dashboard','outings'].includes(next)) { setPage('outings'); notify('Crea una salida para empezar.'); return; }
    if (next === 'games') setGamesFilter('Todos');
    if (['games', 'results', 'capsule', 'passport'].includes(next)) {
      setActivityReturnPage(page === 'outing-detail' ? 'outing-detail' : 'dashboard');
    }
    setPage(next); setProfileMenu(false);
  };
  const openModule = (id) => {
    if (!state.experience?.id) { setPage('outings'); notify('Crea una salida para empezar.'); return; }
    if (page === 'outing-detail' || page === 'dashboard' || page === 'outings' || page === 'friends') {
      setActivityReturnPage(page === 'outing-detail' ? 'outing-detail' : 'dashboard');
    }
    if (!premiumActive && modules.some((item) => item.id === id && item.premium)) { showPremiumNotice(id); return; }
    setModuleId(id); setPage('module');
  };
  const backFromActivity = () => setPage(activityReturnPage);
  const exploreFreeActivities = () => {
    setPremiumItem(null);
    if (!state.experience?.id || !outingPages.includes(page)) {
      changePage('outings');
      return;
    }
    setActivityReturnPage('outing-detail');
    setGamesFilter('Free');
    setPage('games');
  };

  if (!authReady) return <div className="loading-screen"><span className="spinner" /> Preparando tu pasaporte…</div>;
  if (!supabaseConfigured && import.meta.env.PROD) return <LaunchSetupPage onLegal={setLegalDocument} legalDocument={legalDocument} />;

  if (page === 'welcome') return <><Welcome onStart={() => { setAuthMode('signup'); setPage('auth'); }} onLocalPreview={localPreview ? startLocalPreview : undefined} onLogin={() => { setAuthMode('login'); setPage('auth'); }} onLegal={setLegalDocument} cloud={supabaseConfigured} /><LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} />{toast && <Toast message={toast} />}</>;
  if (page === 'auth') return <><AuthPage mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} onBack={() => setPage('welcome')} onLegal={setLegalDocument} busy={busy} cloud={supabaseConfigured} /><LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} />{toast && <Toast message={toast} />}</>;
  if (!state || !currentUser) return <><Welcome onStart={() => setPage('auth')} onLocalPreview={localPreview ? startLocalPreview : undefined} onLogin={() => { setAuthMode('login'); setPage('auth'); }} onLegal={setLegalDocument} cloud={supabaseConfigured} /><LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} /></>;

  const pendingFriendRequests = social.ownerId === currentUser.id ? (social.requests || []).filter((request) => request.recipientId === currentUser.id && request.status === 'pending').length : 0;
  const navigationSection = page === 'module' && activityReturnPage !== 'outing-detail' && moduleId === 'capsule'
    ? 'capsule'
    : outingPages.includes(page) ? 'outings' : page;
  const navigationProps = { activeSection: navigationSection, setPage: changePage, friendRequestCount: pendingFriendRequests };

  return <div className="app-shell">
    <Sidebar {...navigationProps} />
    <div className="app-main">
      <header className="topbar">
        <button className="mobile-brand" onClick={() => setPage('dashboard')} aria-label="Ir al inicio de Chippa"><img src="/assets/chippa/brand.png" alt="CHIPPA" /></button>
        {state.mode === 'demo' && import.meta.env.DEV && <span className="mode-pill"><span /> Solo este dispositivo</span>}
        <button className="membership-button" onClick={() => showPremiumNotice('subscription')}>{premiumActive ? '✓ Premium activo' : '✦ Premium'}</button><div className="profile-wrap">
          {state.mode === 'demo' && import.meta.env.DEV && partner && <button className="switch-profile" onClick={() => update((previous) => ({ ...previous, activeUserId: previous.participants.find((person) => person.id !== previous.activeUserId)?.id || previous.activeUserId }))} title="Cambiar participante">↔ <span>Ver como {partner?.name}</span></button>}
          <button className="profile-button" onClick={() => setProfileMenu((open) => !open)} aria-expanded={profileMenu}><span className="avatar-sm"><Avatar value={currentUser.avatar} /></span><span className="profile-name">{currentUser.name}</span><span>⌄</span></button>
          {profileMenu && <div className="profile-menu">
            {state.mode === 'demo' && import.meta.env.DEV && <button onClick={resetLocalPreview}>Restablecer datos locales</button>}
            <button onClick={leaveExperience}>Salir de esta experiencia</button>
            <button onClick={logout}>Cerrar sesión</button>
          </div>}
        </div>
      </header>
      {state.mode === 'demo' && import.meta.env.DEV && <div className="local-storage-notice"><span>ⓘ</span> Los cambios de esta vista se guardan en este dispositivo.</div>}
      {page === 'friends' && <FriendsPage key={`${currentUser.id}:${friendsVersion}`} person={currentUser} state={state} social={social.ownerId === currentUser.id ? social : { connections: [], requests: [], meetings: [] }} loading={friendsLoading} error={friendsError} onRefresh={() => refreshFriends().catch(() => {})} onNewMeeting={newMeetingWith} onOpenMeeting={selectExperience} onToast={notify} />}
      {page === 'outings' && <OutingsPage outings={outingEntries} activeId={state.experience?.id} openingExperienceId={openingExperienceId} onCreate={openNewOuting} onSelect={selectExperience} />}
      {page === 'dashboard' && <Dashboard state={state} currentUser={currentUser} partner={partner} outings={outingEntries} openingExperienceId={openingExperienceId} onSelectOuting={selectExperience} onPage={changePage} onCreate={openNewOuting} />}
      {page === 'outing-detail' && state.experience?.id && <OutingDetail key={state.experience.id} premiumActive={premiumActive} state={state} onBack={() => changePage('outings')} onOpen={openModule} onPage={changePage} />}
      {page === 'games' && <GamesHub premiumActive={premiumActive} key={gamesFilter} initialFilter={gamesFilter} state={state} onOpen={openModule} onBack={backFromActivity} backLabel={activityReturnPage === 'outing-detail' ? 'Volver a la salida' : undefined} />}
      {page === 'module' && <ExperienceModule
        key={`${state.experience.id}:${moduleId}:${state.activeUserId}`} moduleId={moduleId} state={state} update={update} updateMember={updateMember}
        currentUser={currentUser} partner={partner} currentMember={currentMember}
        onBack={() => modules.find((item) => item.id === moduleId)?.group === 'Juegos' ? setPage('games') : backFromActivity()} onNavigate={openModule} onToast={notify} />}
      {page === 'results' && <ResultsPage state={state} onOpen={openModule} onBack={backFromActivity} update={update} />}
      {page === 'capsule' && <ExperienceModule key={`${state.experience.id}:capsule:${state.activeUserId}`} moduleId="capsule" state={state} update={update} updateMember={updateMember} currentUser={currentUser} partner={partner} currentMember={currentMember} onBack={backFromActivity} onToast={notify} />}
      {page === 'passport' && <ExperienceModule moduleId="passport" state={state} update={update} updateMember={updateMember} currentUser={currentUser} partner={partner} currentMember={currentMember} onBack={backFromActivity} onToast={notify} />}
      {showExperienceForm && <OutingForm friend={meetingFriend} friends={outingFriends} friendsLoading={friendsLoading}
        friendsError={friendsError} onRetryFriends={() => refreshFriends().catch(() => {})}
        onClose={closeOutingForm} onSubmit={createExperience} busy={busy} />}
      <nav className="mobile-nav" aria-label="Navegación principal"><NavigationButtons {...navigationProps} mobile /></nav>
      <LegalFooter className="app-legal-footer" onOpen={setLegalDocument} />
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
    <LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} />
    <PremiumCheckout active={premiumActive} onActivate={activatePremium} onCancel={cancelPremium} item={premiumItem} onClose={() => setPremiumItem(null)} onFree={exploreFreeActivities} />
  </div>;
}

function Toast({ message }) { return <div className="toast" role="status">{message}</div>; }

function LaunchSetupPage({ onLegal, legalDocument }) {
  return <main className="welcome-page"><nav className="welcome-nav"><Brand /></nav><section className="launch-ready"><div className="eyebrow">CHIPPA · PASAPORTE DE EXPERIENCIAS</div><h1>Estamos preparando<br />nuestro espacio.</h1><p>Muy pronto podrás conectar con tus amigos, crear encuentros y guardar los momentos que quieran atesorar.</p></section><LegalFooter className="welcome-footer" onOpen={onLegal} /><LegalPolicies document={legalDocument} onClose={() => onLegal(null)} /></main>;
}

function Welcome({ onStart, onLocalPreview, onLogin, onLegal, cloud }) {
  return <main className="welcome-page">
    <nav className="welcome-nav"><Brand /><div className="nav-actions"><button className="text-button" onClick={onLogin}>Iniciar sesión</button><button className="nav-cta" onClick={onStart}>Crear cuenta <span>↗</span></button></div></nav>
    <section className="welcome-hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="star-animated">✦</span> PASAPORTE DE EXPERIENCIAS</div>
        <h1>La cita terminó,<br />la historia <em>continúa.</em></h1>
        <p>Un espacio para volver a ese momento, descubrir sus dos versiones y planear lo que viene.</p>
        <div className="hero-actions"><button className="primary-button" onClick={onStart}>Comenzar nuestra historia <span>→</span></button>{onLocalPreview && <button className="local-preview-link" onClick={onLocalPreview}>Explorar en este dispositivo <span>↗</span></button>}</div>
        <div className="hand-note">coleccionen lugares,<br />coleccionen momentos <img src="/assets/chippa/heart-note.png" alt="" /></div>
        <div className="hero-proof">
          <span className="proof-item"><img src="/assets/chippa/camera-icon.png" alt="" /><span>Un recuerdo compartido, a su ritmo</span></span>
          <i />
          <span className="proof-item"><img src="/assets/chippa/heart-ticket-icon.png" alt="" /><span>Momentos para atesorar</span></span>
        </div>
      </div>
      <div className="hero-art-wrap">
        <div className="hero-sticker sticker-star sticker-star-large" aria-hidden="true">✦</div>
        <div className="hero-sticker sticker-star">✦</div><div className="hero-sticker sticker-heart">♡</div>
        <div className="hero-art-paper">
          <div className="hero-cover-crop">
            <img className="hero-passport-cover" src="/assets/chippa/pasaporte.png" alt="Portada del pasaporte Chippa" />
          </div>
          <div className="polaroid-caption"><span>Nuestra pequeña historia</span></div>
        </div>
      </div>
      <div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" />
    </section>
    <LegalFooter className="welcome-footer" onOpen={onLegal} />
  </main>;
}

function Brand() { return <div className="brand-lockup"><img src="/assets/chippa/brand.png" alt="CHIPPA" /></div>; }

function AuthPage({ mode, setMode, onSubmit, onBack, onLegal, busy, cloud }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', avatar: avatars[0] });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault(); setError('');
    if (!form.email.trim() || !form.password) { setError('Completa tu correo y contraseña.'); return; }
    if (mode === 'signup' && !form.name.trim()) { setError('Cuéntanos cómo te llamamos.'); return; }
    if (mode === 'signup' && form.password !== form.confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (form.password.length < 6) { setError('Usa al menos 6 caracteres para tu contraseña.'); return; }
    onSubmit(form);
  };
  return <main className="auth-page"><button className="back-link" onClick={onBack}>← Volver</button><Brand /><section className="auth-card">
    <div className="eyebrow">{mode === 'signup' ? 'EMPIEZA TU PASAPORTE' : 'QUÉ BUENO VERTE'}</div>
    <h1>{mode === 'signup' ? 'Toda historia tiene dos versiones.' : 'Tu historia te espera.'}</h1>
    <p>{cloud ? 'Tu cuenta protege y sincroniza tus recuerdos.' : 'Vista local: los cambios se guardan en este dispositivo y no se sincronizan.'}</p>
    <form onSubmit={submit}>
      {mode === 'signup' && <>
        <label>Tu nombre o apodo<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="¿Cómo te llamamos?" autoComplete="name" required /></label>
        <div className="avatar-picker"><span>Elige tu avatar</span><div>{avatarOptions.map((avatar) => <button type="button" key={avatar.src} className={form.avatar === avatar.src ? 'selected' : ''} onClick={() => setForm({ ...form, avatar: avatar.src })} aria-label={avatar.label} aria-pressed={form.avatar === avatar.src} title={avatar.label}><Avatar value={avatar.src} /></button>)}</div></div>
      </>}
      <label>Correo electrónico<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@correo.com" autoComplete="email" required /></label>
      <label>Contraseña<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="6 caracteres o más" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></span></label>
      {mode === 'signup' && <label>Confirma tu contraseña<input type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" required /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-button" disabled={busy}>{busy ? 'Un momento…' : mode === 'signup' ? 'Crear mi perfil →' : 'Iniciar sesión →'}</button>
    </form>
    <div className="auth-switch">{mode === 'signup' ? '¿Ya tienes una cuenta?' : '¿Primera vez por aquí?'} <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? 'Iniciar sesión' : 'Crear perfil'}</button></div>
    {!cloud && <div className="storage-note">ⓘ La creación de cuentas y la sincronización se habilitan al conectar CHIPPA.</div>}
  </section><LegalFooter className="auth-legal-footer" onOpen={onLegal} /></main>;
}

function Sidebar(props) {
  return <aside className="sidebar">
    <button type="button" className="sidebar-brand" onClick={() => props.setPage('dashboard')} aria-label="Ir al inicio de Chippa"><Brand /></button>
    <nav className="sidebar-links" aria-label="Navegación principal"><NavigationButtons {...props} /></nav>
    <div className="sidebar-bottom"><div className="sidebar-sticker">✦ <span>coleccionen<br />momentos</span> ♡</div><div className="sidebar-foot">Hecho para guardar historias</div></div>
  </aside>;
}

function NavigationButtons({ activeSection, setPage, friendRequestCount, mobile = false }) {
  return navigationItems.map(({ target, icon, label }) => {
    const active = activeSection === target;
    return <button
      type="button"
      key={target}
      className={[!mobile && 'side-link', active && 'active'].filter(Boolean).join(' ')}
      onClick={() => setPage(target)}
      aria-current={active ? 'page' : undefined}
    >
      <SidebarIcon name={icon} />
      {label}
      {target === 'friends' && friendRequestCount > 0 && <i className="friend-nav-badge" aria-label={`${friendRequestCount} solicitudes pendientes`}>{friendRequestCount}</i>}
    </button>;
  });
}

function Dashboard({ state, currentUser, partner, outings = [], openingExperienceId, onSelectOuting, onPage, onCreate }) {
  const hasActiveOuting = Boolean(state.experience?.id);
  const quickDetails = {
    outings: 'Abre tus planes guardados',
    friends: 'Conecta y organiza algo juntos',
    capsule: 'Guarda recuerdos',
    passport: 'Mira tu colección CHIPPA'
  };
  return <main className="content dashboard-content">
    <section className="home-outings-dashboard" aria-labelledby="home-outings-title">
      <header className="home-outings-heading">
        <div><div className="eyebrow">TU ESPACIO CHIPPA <span>✦</span></div><h1 id="home-outings-title">Tus salidas de un vistazo.</h1><p>Encuentra tus planes y vuelve r&aacute;pidamente a lo que quieres hacer.</p></div>
        <div className="home-outings-actions"><button className="home-create-button" onClick={onCreate}>＋ Crear salida</button><button className="home-all-outings" onClick={() => onPage('outings')}>Ver todas <span>→</span></button></div>
      </header>
      <div className="home-outings-grid">
        <section className="home-outings-panel" aria-labelledby="home-recent-title">
          <div className="home-panel-heading"><div><span className="home-panel-icon"><HomeQuickIcon name="outings" /></span><div><h2 id="home-recent-title">Salidas recientes</h2><p>{outings.length} {outings.length === 1 ? 'plan guardado' : 'planes guardados'}</p></div></div><button onClick={() => onPage('outings')} aria-label="Ver todas las salidas">Ver lista <span>→</span></button></div>
          {outings.length ? <div className="home-recent-list">{outings.slice(0, 4).map((outing) => {
            const active = outing.id === state.experience?.id;
            return <button type="button" className={`home-recent-outing ${active ? 'active' : ''}`} key={outing.id} onClick={() => onSelectOuting(outing.id)} aria-current={active ? 'true' : undefined} aria-busy={openingExperienceId === outing.id || undefined} disabled={Boolean(openingExperienceId)}>
              <span className="home-recent-mark"><ExperienceMark value={outing.emoji} fallback="✦" /></span><span className="home-recent-copy"><small>{openingExperienceId === outing.id ? 'ABRIENDO…' : active ? 'SALIDA ACTUAL' : 'SALIDA GUARDADA'}</small><b>{outing.title || 'Una nueva salida'}</b><span>{outing.place || 'Lugar por definir'} · {labelDate(outing.date)}</span></span><span className="home-recent-arrow" aria-hidden="true">↗</span>
            </button>;
          })}</div> : <div className="home-outings-empty"><span className="home-empty-art"><HomeQuickIcon name="outings" /></span><div><b>Tu primera salida empieza aqu&iacute;.</b><p>Arma un plan para ti. Invitar a un amigo es opcional.</p></div><button onClick={onCreate}>Planear mi primera salida <span>→</span></button></div>}
          {outings.length > 4 && <button className="home-more-outings" onClick={() => onPage('outings')}>Ver las {outings.length - 4} salidas restantes <span>→</span></button>}
        </section>
        <section className="home-quick-panel" aria-labelledby="home-quick-title">
          <div className="home-panel-heading"><div><span className="home-panel-spark">✦</span><div><h2 id="home-quick-title">Accesos r&aacute;pidos</h2><p>Ve directo a una secci&oacute;n</p></div></div></div>
          <div className="home-quick-grid">
            {navigationItems.slice(1).map(({ target, icon, label }, index) => <button type="button" className={`home-quick-link quick-tone-${index}`} key={target} onClick={() => onPage(target)}>
              <span className="home-quick-icon"><HomeQuickIcon name={icon} /></span>
              <span className="home-quick-copy"><b>{label}</b><small>{quickDetails[target]}</small></span>
              <span className="home-quick-arrow" aria-hidden="true">↗</span>
            </button>)}
          </div>
        </section>
      </div>
    </section>
    {hasActiveOuting && <>
    <div className="dashboard-kicker"><span>CAPÍTULO 01</span><i /> <span>{labelDate(state.experience?.date)}</span></div>
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <div className="eyebrow">{partner ? `HOLA, ${currentUser.name.toUpperCase()}` : 'TU SALIDA, A TU RITMO'} <span>✦</span></div>
        <h1>{partner ? <>Nuestra aventura<br />continúa.</> : <>Tu salida,<br />tu historia.</>}</h1>
        <p>{partner ? 'La cita terminó, pero su historia todavía tiene páginas por llenar.' : 'Guarda tus planes y recuerdos. Puedes conectar con un amigo y crear una salida compartida cuando quieras.'}</p>
        <div className="hero-participants"><span className="participant-avatar"><Avatar value={currentUser.avatar} /></span>{partner && <span className="participant-avatar overlap"><Avatar value={partner.avatar} /></span>}<span>{partner ? `${currentUser.name} + ${partner.name}` : 'Solo tú, por ahora'}</span></div>
        <button className="hero-small-button" disabled={Boolean(openingExperienceId)} onClick={() => onSelectOuting(state.experience.id)}>Ver esta salida <span>→</span></button>
      </div>
      <div className="hero-polaroid"><div className="polaroid-image"><img className="polaroid-backdrop" src="/assets/chippa/collage-azul.jpg" alt="" /><img className="polaroid-character polaroid-character-twins" src="/assets/chippa/estrellas-gemelas-gafas-zapatillas.png" alt="Dos estrellas con gafas y zapatillas" /></div><div className="polaroid-under"><img className="polaroid-map-icon" src="/assets/chippa/mapa-pin.png" alt="" /><div><b>{state.experience?.title}</b><small> {state.experience?.place}</small></div></div><div className="polaroid-tape" /></div>
      <div className="hero-seal"><small>Un<br />recuerdo<br />más</small></div>
      <span className="hero-doodle doodle-one">✧</span><span className="hero-doodle doodle-two">♡</span>
    </section>
    <section className="experience-strip"><div className="experience-meta"><span className="meta-icon"><img src="/assets/chippa/map-icon.png" alt="" /></span><div><small>LUGAR DE LA SALIDA</small><b>{state.experience?.place || 'Lugar por agregar'}</b></div></div><div className="meta-divider" /><div className="experience-meta"><span className="meta-icon"><img src="/assets/chippa/calendar-check-transparent.png" alt="" /></span><div><small>FECHA</small><b>{labelDate(state.experience?.date)}</b></div></div><div className="meta-divider" /><div className="experience-meta"><span className="meta-icon"><img src="/assets/chippa/chat-bubble.png" alt="" /></span><div><small>{partner ? 'ACOMPAÑANTES' : 'PLAN PERSONAL'}</small><b>{partner ? 'Salida compartida' : 'Solo para ti'}</b></div></div><button className="strip-action" onClick={partner ? onCreate : () => onPage('friends')}>{partner ? 'Nueva salida →' : 'Conectar con un amigo →'}</button></section>
    </>}
  </main>;
}

function OutingDetail({ premiumActive, state, onBack, onOpen, onPage }) {
  const titleRef = useRef(null);
  const { experience, participants } = state;
  const isShared = participants.length > 1;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return <main className="content outing-detail" aria-labelledby="outing-detail-title">
    <button type="button" className="back-link" onClick={onBack}>← Volver a mis salidas</button>
    <header className="outings-heading outing-detail-heading">
      <span className="outing-mark" aria-hidden="true"><ExperienceMark value={experience.emoji} fallback="✦" /></span>
      <div>
        <h1 ref={titleRef} id="outing-detail-title" tabIndex={-1}>{experience.title}</h1>
        {experience.description?.trim() && <p>{experience.description}</p>}
      </div>
    </header>
    <dl className="outing-detail-meta">
      <div><dt>Lugar</dt><dd>{experience.place || 'Lugar por definir'}</dd></div>
      <div><dt>Fecha</dt><dd><time dateTime={experience.date}>{labelDate(experience.date)}</time></dd></div>
      <div>
        <dt>{isShared ? 'Participantes' : 'Plan personal'}</dt>
        <dd>{isShared ? <ul>
          {participants.map((person) => <li key={person.id}>
            <span className="avatar-sm"><Avatar value={person.avatar} /></span>
            {person.name}
          </li>)}
        </ul> : 'Solo para ti'}</dd>
      </div>
    </dl>
    <OutingActivities premiumActive={premiumActive} state={state} onOpen={onOpen} onPage={onPage} />
  </main>;
}

function OutingActivities({ premiumActive, state, onOpen, onPage }) {
  const grouped = groupOrder.map((group) => ({ group, items: modules.filter((item) => item.group === group) })).filter((entry) => entry.items.length);
  const doneCount = modules.filter((item) => activityStatus(state, item.id)).length;
  return <>
    <section className="activity-section">
      <div className="section-heading">
        <h2>Actividades de la salida</h2>
        <button type="button" className="all-activities" onClick={() => onPage('results')}>Ver resultados <span aria-hidden="true">↗</span></button>
      </div>
      <div className="activity-groups">
        {grouped.map(({ group, items }, index) => <div className={`activity-group ${group === 'Juegos' ? 'activity-group-games' : ''}`} key={group}>
          <div className="group-heading">
            <span className={`group-index index-${index}`}>0{index + 1}</span>
            <h3>{group}</h3>
            <i />
            {group === 'Juegos' && <button type="button" className="all-activities" onClick={() => onPage('games')}>Ver todos los juegos <span aria-hidden="true">→</span></button>}
          </div>
          <div className={`activity-grid ${items.length === 1 ? 'single-card' : ''}`}>
            {items.map((item) => <ActivityCard premiumActive={premiumActive} key={item.id} item={item} state={state} onOpen={onOpen} />)}
          </div>
        </div>)}
      </div>
    </section>
    <section className="story-progress">
      <div className="progress-icon">✦</div>
      <div>
        <small>{state.participants.length > 1 ? 'SU HISTORIA EN CONSTRUCCIÓN' : 'TU HISTORIA EN CONSTRUCCIÓN'}</small>
        <b>{doneCount} de {modules.length} actividades con timbre CHIPPA</b>
        <div className="progress-track"><span style={{ width: `${Math.min(100, doneCount / modules.length * 100)}%` }} /></div>
      </div>
      <button onClick={() => onPage('capsule')}>Ver cápsula <span>→</span></button>
    </section>
  </>;
}

function OutingsPage({ outings, activeId, openingExperienceId, onCreate, onSelect }) {
  return <main className="content outings-page">
    <header className="outings-heading"><div><div className="eyebrow">TU COLECCIÓN CHIPPA</div><h1>Mis salidas.</h1><p>Todos tus planes y encuentros, en un solo lugar. Cada salida puede ser solo para ti o incluir a un amigo.</p></div><button className="primary-button" onClick={onCreate}>＋ Crear salida</button></header>
    <div className="outings-list-heading"><div><div className="eyebrow">LÍNEA DE TIEMPO</div><h2>{outings.length} {outings.length === 1 ? 'salida' : 'salidas'}</h2></div><span>Ordenadas de la más reciente a la más antigua</span></div>
    {!outings.length ? <EmptyFriends title="Todavía no tienes salidas." text="Crea un plan para ti. Invitar a otra persona es opcional y puedes hacerlo más adelante." action="Crear mi primera salida" onClick={onCreate} /> : <div className="outings-list">
      {outings.map((outing, index) => {
        const active = outing.id === activeId;
        return <article className={`outing-row ${active ? 'active' : ''}`} key={outing.id} aria-current={active ? 'true' : undefined}>
          <span className="outing-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="outing-mark">{active ? <img className="outing-mark-camera" src="/assets/chippa/camera-icon.png" alt="" /> : <ExperienceMark value={outing.emoji} fallback="✦" />}</span>
          <span className="outing-details"><small>{active ? 'SALIDA ACTUAL' : 'SALIDA GUARDADA'}</small><b>{outing.title}</b><span>{outing.place}</span></span>
          <time dateTime={outing.date}>{labelDate(outing.date)}</time>
          <button type="button" className="outing-open" onClick={() => onSelect(outing.id)} aria-label={`${active ? 'Abrir' : 'Ver'} salida ${outing.title}`} aria-busy={openingExperienceId === outing.id || undefined} disabled={Boolean(openingExperienceId)}>{openingExperienceId === outing.id ? 'Abriendo...' : active ? 'Abrir' : 'Ver salida'} <i aria-hidden="true">→</i></button>
        </article>;
      })}
    </div>}
  </main>;
}

function ResultsPage({ state, onOpen, onBack }) {
  const people = state.participants || [];
  const solo = people.length < 2;
  const tiles = [
    { id: 'same', title: '¿Pensamos lo mismo?', field: 'same' },
    { id: 'story', title: 'Completa nuestra historia', field: 'stories' },
    { id: 'trivia', title: 'Trivia post-cita', field: 'trivia' },
    { id: 'moment', title: 'Nuestro momento', field: 'moment' }
  ];
  return <main className="content results-page"><button className="back-link" onClick={onBack}>← Volver a la aventura</button><div className="eyebrow">{solo ? 'TU HISTORIA, A TU RITMO' : 'DOS PERSPECTIVAS, UNA HISTORIA'}</div><h1>{solo ? 'Tus respuestas.' : 'Descubramos nuestras respuestas.'}</h1><p className="page-lede">{solo ? 'Tus respuestas se guardan aqui para que vuelvas a ellas.' : 'Cuando ambas personas terminen y decidan compartir, aqui se reunira lo que vivieron.'}</p><div className="result-unlock-banner"><span>✧</span><div><b>{solo ? 'Tus momentos, en un solo lugar.' : 'Llegó el momento de descubrir qué pensaron.'}</b><small>{solo ? 'Puedes invitar a un amigo a esta salida cuando quieras.' : 'Sin puntajes de compatibilidad. Solo historias que se encuentran.'}</small></div></div>
    <div className="results-list">{tiles.map((tile, index) => {
      const values = people.map((person) => state.memberData?.[person.id]?.[tile.field]);
      const summaries = values.map((value) => {
        if (tile.field === 'moment') return solo ? (value?.ready ? value.favorite : '') : (value?.ready && value?.share ? value.favorite : '');
        const entries = Object.values(value || {}).filter((answer) => solo || answer?.share);
        return entries.map((answer) => answer.value || answer.text || answer.response || '').filter(Boolean).slice(0, 2).join(' · ');
      });
      const ready = summaries.length > 0 && summaries.every(Boolean);
      return <section key={tile.id} className="result-tile"><div className={`result-number result-n-${index}`}>0{index + 1}</div><div className="result-main"><h2>{tile.title}</h2>{ready ? <div className="result-quotes">{people.map((person, personIndex) => <p key={person.id}><span><Avatar value={person.avatar} /> {person.name}</span><b>{summaries[personIndex]}</b></p>)}</div> : <p>{solo ? 'Completa esta actividad y elige que quieres guardar.' : 'Falta que ambas personas respondan y acepten compartir.'}</p>}</div><div className={`status-tag ${ready ? 'ready' : ''}`}>{ready ? 'Revelado' : 'Esperando'}</div><button className="activity-arrow" onClick={() => onOpen(tile.id)}>↗</button></section>;
    })}</div><button className="primary-button" onClick={() => onOpen('capsule')}>Guardar momentos en la cápsula →</button>
  </main>;
}

export { labelDate };
export default App;
