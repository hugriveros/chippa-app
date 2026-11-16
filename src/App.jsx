import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  avatars, avatarOptions, destinations, modules
} from './data.js';
import { loadDemoState, resetDemoState, saveDemoState } from './lib/demoStore.js';
import { supabaseConfigured, supabase } from './lib/supabase.js';
import {
  createCloudExperience, ensureProfile, joinCloudExperience, loadCloudState, makeCloudInvitation,
  cloudSnapshotSignature, leaveCloudExperience, saveCloudState, signIn, signOut, signUp
} from './lib/cloudStore.js';
import ExperienceModule from './ExperienceModule.jsx';
import { labelDate, localDateValue } from './lib/format.js';
import { LegalFooter, LegalPolicies } from './LegalPolicies.jsx';
import GamesHub, { ActivityCard } from './GamesHub.jsx';
import Avatar from './Avatar.jsx';
import FriendsPage, { Empty as EmptyFriends } from './FriendsPage.jsx';
import { createEmptyState, emptyShared, loadFriends } from './lib/friendsStore.js';
import PremiumCheckout from './PremiumCheckout.jsx';
import { activityStatus, completionRecord, loadSimulatedPremium, premiumKey } from './lib/activityStatus.js';

const groupOrder = ['Revive la cita', 'Juegos', 'Cartas', 'Aventuras', 'Conózcanse', 'Guarden recuerdos'];
const emptyMember = () => ({ moment: {}, same: {}, stories: {}, trivia: {}, letters: [], questions: [], future: [], preferences: {}, votes: {} });
const newInvitation = () => `CH-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

const CHISPOSITA_CIRCLE_ICON = '/assets/chippa/chisposita-circulo.png';

function ExperienceMark({ value, fallback = '💫' }) {
  const mark = value || fallback;
  return typeof mark === 'string' && mark.startsWith('/assets/chippa/')
    ? <img className="experience-mark-image" src={mark} alt="" />
    : mark;
}

function PremiumLockIcon() {
  return <svg className="premium-lock-icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="9" rx="2" /><path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" /><path d="M10 12v2" /></svg>;
}

function ExperienceDateField({ value, onChange }) {
  return <div className="experience-date-field"><input type="date" value={value} onChange={(event) => onChange(event.target.value)} required /><img src="/assets/chippa/calendar-pink-check.png" alt="" /></div>;
}

function ChispositaEmojiField() {
  return <div className="experience-emoji-field" role="img" aria-label="Chisposita en círculo"><img src={CHISPOSITA_CIRCLE_ICON} alt="" /></div>;
}

function App() {
  const localPreview = import.meta.env.DEV && !supabaseConfigured;
  const [page, setPage] = useState('welcome');
  const [moduleId, setModuleId] = useState('moment');
  const [state, setState] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [authMode, setAuthMode] = useState('signup');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [legalDocument, setLegalDocument] = useState(null);
  const [premiumItem, setPremiumItem] = useState(null);
  const [premiumActive, setPremiumActive] = useState(false);
  const [gamesFilter, setGamesFilter] = useState('Todos');
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [showExperienceMenu, setShowExperienceMenu] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [social, setSocial] = useState({ connections: [], invitations: [], meetings: [] });
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [meetingFriend, setMeetingFriend] = useState(null);
  const [friendsVersion, setFriendsVersion] = useState(0);
  const syncTimer = useRef(null);
  const lastCloudSignature = useRef('');
  const cloudSnapshotKey = useRef('');
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
          if (loaded) { setState(loaded); setPage(new URLSearchParams(window.location.search).get('friend') || !loaded.experience?.id ? 'friends' : 'dashboard'); }
          else setPage('friends');
        } catch (loadError) { notify(loadError.message || 'No pudimos cargar tus experiencias.'); setPage('welcome'); }
      }
      if (alive) setAuthReady(true);
    }).catch(() => { if (alive) { setAuthReady(true); notify('No pudimos conectar tu cuenta. Puedes volver a iniciar sesión.'); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (!session?.user) { setUser(null); setState(null); setPage('welcome'); return; }
      setUser(session.user);
      window.setTimeout(async () => {
        try {
          await acceptPendingInvite(session.user);
          const loaded = await loadCloudState(session.user);
          if (!alive) return;
          if (loaded) { setState(loaded); setPage(new URLSearchParams(window.location.search).get('friend') || !loaded.experience?.id ? 'friends' : 'dashboard'); }
          else setPage('friends');
        } catch (error) { notify(error.message || 'No pudimos abrir esta invitación.'); setPage('friends'); }
      }, 0);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [notify, acceptPendingInvite]);

  useEffect(() => {
    if (!state || state.mode !== 'cloud' || !state.experience?.id || !supabase) return undefined;
    const channel = supabase.channel(`chippa-${state.experience.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experience_state', filter: `experience_id=eq.${state.experience.id}` }, async () => {
        if (!user) return;
        try { const fresh = await loadCloudState(user); if (fresh) setState(fresh); } catch { /* Se conserva la última versión local. */ }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participant_shared_state', filter: `experience_id=eq.${state.experience.id}` }, async () => {
        if (!user) return;
        try { const fresh = await loadCloudState(user); if (fresh) setState(fresh); } catch { /* Se conserva la última versión local. */ }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experience_participants', filter: `experience_id=eq.${state.experience.id}` }, async () => {
        if (!user) return;
        try { const fresh = await loadCloudState(user); if (fresh) setState(fresh); } catch { /* Se conserva la última versión local. */ }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [state?.mode, state?.experience?.id, user?.id]);

  useEffect(() => {
    if (!state || state.mode !== 'cloud' || !user) return undefined;
    const snapshotKey = `${user.id}:${state.experience?.id}`;
    if (cloudSnapshotKey.current !== snapshotKey) {
      cloudSnapshotKey.current = snapshotKey;
      lastCloudSignature.current = '';
    }
    const signature = cloudSnapshotSignature(state, user.id);
    if (signature === lastCloudSignature.current) return undefined;
    const previousSignature = lastCloudSignature.current;
    lastCloudSignature.current = signature;
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      saveCloudState(state, user.id).catch((error) => {
        if (lastCloudSignature.current === signature) lastCloudSignature.current = previousSignature;
        notify(error.message || 'No pudimos sincronizar este cambio.');
      });
    }, 650);
    return () => window.clearTimeout(syncTimer.current);
  }, [state, user, notify]);

  const currentUser = useMemo(() => state?.participants?.find((person) => person.id === state.activeUserId) || state?.participants?.[0], [state]);
  const partner = useMemo(() => state?.participants?.find((person) => person.id !== currentUser?.id), [state, currentUser]);
  const currentMember = state?.memberData?.[state?.activeUserId] || emptyMember();

  const update = useCallback((updater) => {
    setState((previous) => {
      if (!previous) return previous;
      const next = typeof updater === 'function' ? updater(previous) : { ...previous, ...updater };
      if (next.mode === 'demo') saveDemoState(next);
      return next;
    });
  }, []);

  const updateMember = useCallback((updater, memberId) => {
    const id = memberId || state?.activeUserId;
    if (!id) return;
    update((previous) => {
      const before = previous.memberData?.[id] || emptyMember();
      const after = typeof updater === 'function' ? updater(before) : { ...before, ...updater };
      return { ...previous, memberData: { ...previous.memberData, [id]: after } };
    });
  }, [state?.activeUserId, update]);

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
    if (!currentUser || !state) return;
    setFriendsLoading(true); setFriendsError('');
    try { const result = await loadFriends(currentUser, state); setSocial({ ...result, ownerId: currentUser.id }); return result; }
    catch (error) { setFriendsError('No pudimos cargar tus amigos. Intenta nuevamente.'); throw error; }
    finally { setFriendsLoading(false); }
  }, [state, currentUser]);
  useEffect(() => { if (page === 'friends') { let active = true; loadFriends(currentUser, state).then((result) => { if (active) { setSocial({ ...result, ownerId: currentUser.id }); setFriendsError(''); } }).catch(() => { if (active) setFriendsError('No pudimos cargar tus amigos. Intenta nuevamente.'); }).finally(() => { if (active) setFriendsLoading(false); }); setFriendsLoading(true); return () => { active = false; }; } }, [page, state, currentUser, friendsVersion]);
  useEffect(() => {
    if (page !== 'friends' || !currentUser) return undefined;
    const refresh = () => { if (!document.hidden) refreshFriends().catch(() => {}); };
    window.addEventListener('focus', refresh); window.addEventListener('storage', refresh);
    const timer = state.mode === 'cloud' ? window.setInterval(refresh, 30000) : null;
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); if (timer) window.clearInterval(timer); };
  }, [page, currentUser?.id, state?.mode, refreshFriends]);
  const newMeetingWith = (friend) => { setMeetingFriend(friend); setShowExperienceForm(true); };

  const startLocalPreview = () => {
    const demo = loadDemoState();
    if (demo.experience && !demo.experience.invitationCode) demo.experience.invitationCode = newInvitation();
    saveDemoState(demo);
    setState(demo);
    setPage(new URLSearchParams(window.location.search).get('friend') || !demo.experience?.id ? 'friends' : 'dashboard');
    notify('Tu espacio está listo en este dispositivo.');
  };

  const handleAuth = async (form) => {
    if (!supabaseConfigured) {
      if (import.meta.env.PROD) { notify('El acceso a CHIPPA todavía se está preparando.'); return; }
      const next = authMode === 'login' ? loadDemoState() : createEmptyState({ id: `local-${crypto.randomUUID()}`, name: form.name.trim(), avatar: form.avatar || avatars[0] });
      setState(next); saveDemoState(next); setPage('friends');
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
        if (loaded) { setState(loaded); setPage(new URLSearchParams(window.location.search).get('friend') || !loaded.experience?.id ? 'friends' : 'dashboard'); } else setPage('friends');
      }
    } catch (error) { notify(error.message || 'No pudimos continuar. Revisa tus datos.'); }
    finally { setBusy(false); }
  };

  const createExperience = async (form) => {
    if (!meetingFriend) { setPage('friends'); return; }
    if (state?.mode === 'cloud' || (!state && user && supabaseConfigured)) {
      setBusy(true);
      try {
        const created = await createCloudExperience(user.id, form, meetingFriend.id);
        const loaded = await loadCloudState(user, created.id);
        setState(loaded ? { ...loaded, experience: { ...loaded.experience, invitationCode: created.invitationCode } } : { ...state, experience: { ...created, status: 'active' }, mode: 'cloud' });
        setShowExperienceForm(false);
        setPage('dashboard');
        notify('Encuentro creado para los dos.');
      } catch (error) { notify(error.message || 'No pudimos crear la experiencia.'); }
      finally { setBusy(false); }
      return;
    }
    const experience = { ...form, id: `demo-${Date.now()}`, status: 'active', createdBy: state?.activeUserId, invitationCode: newInvitation(), invitationAccepted: true };
    update((previous) => {
      const archive = previous.experience?.title ? [{ experience: previous.experience, memberData: previous.memberData, shared: previous.shared, participants: previous.participants }] : [];
      const people = [currentUser, meetingFriend];
      const newMembers = Object.fromEntries(people.map((person) => [person.id, emptyMember()]));
      return {
        ...previous,
        experience,
        participants: people,
        memberData: newMembers,
        experienceArchives: [...archive, ...(previous.experienceArchives || [])],
        shared: { ...emptyShared(), stamps: [form.place] }
      };
    });
    setShowExperienceForm(false);
    setPage('dashboard');
    notify('¡Nuevo lugar para su colección!');
  };

  const selectExperience = async (experienceId) => {
    setShowExperienceMenu(false);
    if (state.experience?.id === experienceId) { setPage('dashboard'); return; }
    if (state.mode === 'cloud') {
      setBusy(true);
      try { const selected = await loadCloudState(user, experienceId); if (selected) { setState(selected); setPage('dashboard'); } }
      catch (error) { notify(error.message || 'No pudimos abrir esa experiencia.'); }
      finally { setBusy(false); }
      return;
    }
    const selected = (state.experienceArchives || []).find((entry) => entry.experience.id === experienceId);
    if (!selected) return;
    const current = { experience: state.experience, memberData: state.memberData, shared: state.shared, participants: state.participants };
    setState((previous) => {
      const rest = previous.experienceArchives.filter((entry) => entry.experience.id !== experienceId);
      const next = { ...previous, ...selected, participants: selected.participants || previous.participants, experienceArchives: [current, ...rest] };
      saveDemoState(next);
      return next;
    });
    setPage('dashboard');
  };

  const invitePartner = async () => {
    if (!state) return;
    if (state.mode === 'cloud') {
      try {
        const code = await makeCloudInvitation(state.experience.id);
        const link = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(code)}`;
        await navigator.clipboard.writeText(link);
        update((previous) => ({ ...previous, experience: { ...previous.experience, invitationCode: code } }));
        notify('Enlace de invitación copiado.');
      } catch (error) { notify(error.message || 'No pudimos crear el enlace.'); }
      return;
    }
    const code = state.experience?.invitationCode || newInvitation();
    const link = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(code)}`;
    try { await navigator.clipboard.writeText(link); notify('Enlace copiado. Para conectar otro dispositivo, abre el enlace e inicia sesión.'); }
    catch { notify(`Código de invitación: ${code}`); }
  };

  const acceptDemoInvite = () => {
    update((previous) => ({ ...previous, experience: { ...previous.experience, invitationAccepted: true } }));
    notify('¡Acompañante vinculado en este dispositivo!');
  };

  const logout = async () => {
    if (state?.mode === 'demo') {
      setState(null); setPage('welcome');
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
      if (next) { setState(next); setPage('dashboard'); }
      else { setState(null); setPage('friends'); }
      notify('Saliste de esta experiencia.');
    } catch (error) { notify(error.message || 'No pudimos salir de la experiencia.'); }
  };

  const showPremiumNotice = (id = 'capsule') => setPremiumItem(modules.find((item) => item.id === id) || { id: 'subscription', title: 'CHIPPA Premium' });
  const changePage = (next) => {
    if (next === 'friends') setFriendsVersion((version) => version + 1);
    if (!state.experience?.id && !['friends','dashboard'].includes(next)) { setPage('friends'); notify('Crea un encuentro con un amigo para empezar.'); return; }
    if (next === 'games') setGamesFilter('Todos');
    if (!premiumActive && next === 'capsule' && modules.some((item) => item.id === 'capsule' && item.premium)) { showPremiumNotice(); return; }
    setPage(next); setProfileMenu(false);
  };
  const openModule = (id) => {
    if (!state.experience?.id) { setPage('friends'); notify('Elige un amigo y crea un encuentro para empezar.'); return; }
    if (!premiumActive && modules.some((item) => item.id === id && item.premium)) { showPremiumNotice(id); return; }
    setModuleId(id); setPage('module');
  };

  if (!authReady) return <div className="loading-screen"><span className="spinner" /> Preparando tu pasaporte…</div>;
  if (!supabaseConfigured && import.meta.env.PROD) return <LaunchSetupPage onLegal={setLegalDocument} legalDocument={legalDocument} />;

  if (page === 'welcome') return <><Welcome onStart={() => { setAuthMode('signup'); setPage('auth'); }} onLocalPreview={localPreview ? startLocalPreview : undefined} onLogin={() => { setAuthMode('login'); setPage('auth'); }} onLegal={setLegalDocument} cloud={supabaseConfigured} /><LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} />{toast && <Toast message={toast} />}</>;
  if (page === 'auth') return <><AuthPage mode={authMode} setMode={setAuthMode} onSubmit={handleAuth} onBack={() => setPage('welcome')} onLegal={setLegalDocument} busy={busy} cloud={supabaseConfigured} /><LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} />{toast && <Toast message={toast} />}</>;
  if (!state || !currentUser) return <><Welcome onStart={() => setPage('auth')} onLocalPreview={localPreview ? startLocalPreview : undefined} onLogin={() => { setAuthMode('login'); setPage('auth'); }} onLegal={setLegalDocument} cloud={supabaseConfigured} /><LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} /></>;

  return <div className="app-shell">
    <Sidebar premiumActive={premiumActive} page={page} setPage={changePage} openModule={openModule} state={state} />
    <div className="app-main">
      <header className="topbar">
        <button className="mobile-brand" onClick={() => setPage('dashboard')} aria-label="Ir al inicio de Chippa"><img src="/assets/chippa/brand.png" alt="CHIPPA" /></button>
        <div className="experience-switcher"><button className="experience-switch-button" onClick={() => setShowExperienceMenu((open) => !open)} aria-expanded={showExperienceMenu}><span><ExperienceMark value={state.experience?.emoji} /></span><b>{state.experience?.title || 'Mis encuentros'}</b><i>⌄</i></button>{showExperienceMenu && <div className="experience-menu">{(state.mode === 'cloud' ? state.experienceOptions || [] : [...(state.experience?.id ? [state.experience] : []), ...(state.experienceArchives || []).map((entry) => entry.experience)]).map((item) => <button key={item.id} className={item.id === state.experience?.id ? 'active' : ''} onClick={() => selectExperience(item.id)}><span><ExperienceMark value={item.emoji} /></span><span><b>{item.title}</b><small>{item.place} · {labelDate(item.date)}</small></span></button>)}<button className="new-experience-option" onClick={() => { setShowExperienceMenu(false); setPage('friends'); }}>＋ Registrar otra experiencia</button></div>}</div>
        <div className="crumb">{page === 'module' ? modules.find((item) => item.id === moduleId)?.title : page === 'friends' ? 'Mis amigos' : page === 'games' ? 'Juegos para dos' : page === 'dashboard' ? 'Nuestra cita' : page === 'results' ? 'Descubramos nuestras respuestas' : page === 'passport' ? 'Pasaporte digital' : 'Cápsula compartida'}</div>
        {state.mode === 'demo' && import.meta.env.DEV && <span className="mode-pill"><span /> Solo este dispositivo</span>}
        {state.mode === 'cloud' && <span className="mode-pill cloud-pill"><span /> Cuenta sincronizada</span>}
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
      {page === 'friends' && <FriendsPage key={`${currentUser.id}:${friendsVersion}`} person={currentUser} state={state} social={social.ownerId === currentUser.id ? social : { connections: [], invitations: [], meetings: [] }} loading={friendsLoading} error={friendsError} onRefresh={() => refreshFriends().catch(() => {})} onNewMeeting={newMeetingWith} onOpenMeeting={selectExperience} onToast={notify} />}
      {page === 'dashboard' && !state.experience?.id && <main className="content"><EmptyFriends title="Tu historia empieza con tus amigos." text="Invita a alguien, conecten y creen juntos su primer encuentro." action="Ver mis amigos" onClick={() => setPage('friends')} /></main>}
      {page === 'dashboard' && state.experience?.id && <Dashboard premiumActive={premiumActive} state={state} currentUser={currentUser} partner={partner} onOpen={openModule} onPage={changePage} onPremium={showPremiumNotice} onCreate={() => setPage('friends')} onInvite={invitePartner} onAcceptInvite={acceptDemoInvite} localPreview={localPreview} />}
      {page === 'games' && <GamesHub premiumActive={premiumActive} key={gamesFilter} initialFilter={gamesFilter} state={state} onOpen={openModule} onBack={() => setPage('dashboard')} />}
      {page === 'module' && <ExperienceModule
        key={`${state.experience.id}:${moduleId}:${state.activeUserId}`} moduleId={moduleId} state={state} update={update} updateMember={updateMember}
        currentUser={currentUser} partner={partner} currentMember={currentMember}
        onBack={() => setPage(modules.find((item) => item.id === moduleId)?.group === 'Juegos' ? 'games' : 'dashboard')} onNavigate={openModule} onToast={notify} />}
      {page === 'results' && <ResultsPage state={state} onOpen={openModule} onBack={() => setPage('dashboard')} update={update} />}
      {page === 'capsule' && <ExperienceModule moduleId="capsule" state={state} update={update} updateMember={updateMember} currentUser={currentUser} partner={partner} currentMember={currentMember} onBack={() => setPage('dashboard')} onToast={notify} />}
      {page === 'passport' && <ExperienceModule moduleId="passport" state={state} update={update} updateMember={updateMember} currentUser={currentUser} partner={partner} currentMember={currentMember} onBack={() => setPage('dashboard')} onToast={notify} />}
      {showExperienceForm && meetingFriend && <ExperienceForm friend={meetingFriend} onClose={() => setShowExperienceForm(false)} onSubmit={createExperience} busy={busy} />}
      <MobileNav premiumActive={premiumActive} page={page} setPage={changePage} openGames={() => changePage('games')} />
      <LegalFooter className="app-legal-footer" onOpen={setLegalDocument} />
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
    <LegalPolicies document={legalDocument} onClose={() => setLegalDocument(null)} />
    <PremiumCheckout active={premiumActive} onActivate={activatePremium} onCancel={cancelPremium} item={premiumItem} onClose={() => setPremiumItem(null)} onFree={() => { setPremiumItem(null); setGamesFilter('Free'); setPage('games'); }} />
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

function Sidebar({ premiumActive, page, setPage, openModule, state }) {
  const quick = [ ['moment', 'Nuestra cita', '📓'], ['same', 'Juegos', '🎮'], ['letters', 'Cartas', '💌'], ['next', 'Aventuras', '🗺️'] ];
  return <aside className="sidebar"><button className="sidebar-brand" onClick={() => setPage('dashboard')} aria-label="Ir al inicio de Chippa"><Brand /></button><div className="experience-chip"><span><ExperienceMark value={state.experience?.emoji} /></span><div><b>{state.experience?.title || 'Tu espacio en CHIPPA'}</b><small>{state.experience?.place || 'Conecta con tus amigos'}</small></div><span className="chip-dots">···</span></div>
    <div className="side-label">LA HISTORIA</div><button className={`side-link ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}><span>▧</span> Inicio</button>
    <button className={`side-link ${page === 'friends' ? 'active' : ''}`} onClick={() => setPage('friends')}><span>♡</span> Amigos</button>
    <div className="side-label spaced">EXPLORAR</div>{quick.map(([id, title, emoji]) => {
      const premium = !premiumActive && id !== 'same' && modules.some((item) => item.id === id && item.premium);
      return <button className={`side-link ${title === 'Juegos' && (page === 'games' || page === 'module' && ['same','story','memory','missions','trivia'].includes(id)) ? 'active' : ''} ${premium ? 'premium-menu-link' : ''}`} key={id} onClick={() => id === 'same' ? setPage('games') : openModule(id)} title={premium ? 'Contenido Premium bloqueado' : undefined}><span>{emoji}</span>{title}{premium ? <span className="side-premium-lock" role="img" aria-label="Premium bloqueado"><PremiumLockIcon /></span> : <i>→</i>}</button>;
    })}
    <div className="side-label spaced">SU RECUERDO</div><button className={`side-link ${page === 'results' ? 'active' : ''}`} onClick={() => setPage('results')}><span>✦</span> Sus respuestas</button><button className={`side-link ${premiumActive ? '' : 'premium-menu-link'} ${page === 'capsule' ? 'active' : ''}`} onClick={() => setPage('capsule')} title="Contenido Premium bloqueado"><span>📸</span> Cápsula{!premiumActive && <span className="side-premium-lock" role="img" aria-label="Premium bloqueado"><PremiumLockIcon /></span>}</button><button className={`side-link ${page === 'passport' ? 'active' : ''}`} onClick={() => setPage('passport')}><span>🛂</span> Pasaporte</button>
    <div className="sidebar-bottom"><div className="sidebar-sticker">✦ <span>coleccionen<br />momentos</span> ♡</div><div className="sidebar-foot">Hecho para guardar historias</div></div>
  </aside>;
}

function MobileNav({ premiumActive, page, setPage, openGames }) {
  const items = [
    ['dashboard', '⌂', 'Inicio', null], ['games', '🎮', 'Juegos', null], ['friends', '♡', 'Amigos', null], ['capsule', '📸', 'Cápsula', 'capsule'], ['passport', '🛂', 'Pasaporte', null]
  ];
  return <nav className="mobile-nav" aria-label="Navegación principal">{items.map(([target, icon, label, premiumId]) => {
    const premium = !premiumActive && Boolean(premiumId && modules.some((item) => item.id === premiumId && item.premium));
    return <button key={target} className={`${page === target ? 'active' : ''} ${premium ? 'premium-nav-link' : ''}`} onClick={() => target === 'games' ? openGames() : setPage(target)} aria-disabled={premium || undefined} title={premium ? 'Contenido Premium bloqueado' : undefined}><span>{icon}</span>{label}{premium && <i className="mobile-premium-lock"><PremiumLockIcon /></i>}</button>;
  })}</nav>;
}

function Dashboard({ premiumActive, state, currentUser, partner, onOpen, onPage, onPremium, onCreate, onInvite, onAcceptInvite, localPreview }) {
  const grouped = groupOrder.map((group) => ({ group, items: modules.filter((item) => item.group === group) })).filter((entry) => entry.items.length);
  const doneCount = modules.filter((item) => activityStatus(state, item.id)).length;
  return <main className="content dashboard-content">
    <div className="dashboard-kicker"><span>CAPÍTULO 01</span><i /> <span>{labelDate(state.experience?.date)}</span></div>
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy"><div className="eyebrow">HOLA, {currentUser.name.toUpperCase()} <span>✦</span></div><h1>Nuestra aventura<br />continúa.</h1><p>La cita terminó, pero su historia todavía tiene páginas por llenar.</p><div className="hero-participants"><span className="participant-avatar"><Avatar value={currentUser.avatar} /></span><span className="participant-avatar overlap"><Avatar value={partner?.avatar} /></span><span>{currentUser.name} + {partner?.name || 'tu acompañante'}</span></div><button className="hero-small-button" onClick={() => onOpen('moment')}>Volver a ese momento <span>→</span></button></div>
      <div className="hero-polaroid"><div className="polaroid-image"><img className="polaroid-backdrop" src="/assets/chippa/collage-azul.jpg" alt="" /><img className="polaroid-character polaroid-character-twins" src="/assets/chippa/estrellas-gemelas-gafas-zapatillas.png" alt="Dos estrellas con gafas y zapatillas" /></div><div className="polaroid-under"><img className="polaroid-map-icon" src="/assets/chippa/mapa-pin.png" alt="" /><div><b>{state.experience?.title}</b><small> {state.experience?.place}</small></div></div><div className="polaroid-tape" /></div>
      <div className="hero-seal"><small>Un<br />recuerdo<br />más</small></div>
      <span className="hero-doodle doodle-one">✧</span><span className="hero-doodle doodle-two">♡</span>
    </section>
    <section className="experience-strip"><div className="experience-meta"><span className="meta-icon"><img src="/assets/chippa/map-icon.png" alt="" /></span><div><small>LUGAR VISITADO</small><b>{state.experience?.place || 'Lugar por agregar'}</b></div></div><div className="meta-divider" /><div className="experience-meta"><span className="meta-icon"><img src="/assets/chippa/calendar-check-transparent.png" alt="" /></span><div><small>FECHA DE LA CITA</small><b>{labelDate(state.experience?.date)}</b></div></div><div className="meta-divider" /><div className="experience-meta"><span className="meta-icon"><img src="/assets/chippa/chat-bubble.png" alt="" /></span><div><small>INVITACIÓN</small><b>{state.experience?.invitationAccepted ? 'Ambos vinculados' : 'Aún pendiente'}</b></div></div><button className="strip-action" onClick={state.experience?.invitationAccepted ? onCreate : onInvite}>{state.experience?.invitationAccepted ? 'Nueva experiencia ↗' : 'Invitar ↗'}</button>{localPreview && !state.experience?.invitationAccepted && <button className="strip-accept" onClick={onAcceptInvite}>Aceptar aquí</button>}</section>
    <section className="activity-section"><div className="section-heading"><div><div className="eyebrow">ELIGE POR DÓNDE SEGUIR</div><h2>Hay muchas formas de continuar.</h2></div><button className="all-activities" onClick={() => onPage('results')}>Ver resultados <span>↗</span></button></div>
      <div className="activity-groups">{grouped.map(({ group, items }, index) => <div className={`activity-group ${group === 'Juegos' ? 'activity-group-games' : ''}`} key={group}><div className="group-heading"><span className={`group-index index-${index}`}>0{index + 1}</span><h3>{group}</h3><i /></div><div className={`activity-grid ${items.length === 1 ? 'single-card' : ''}`}>{items.map((item) => <ActivityCard premiumActive={premiumActive} key={item.id} item={item} state={state} onOpen={onOpen} />)}</div></div>)}</div>
    </section>
    <section className="story-progress"><div className="progress-icon">✦</div><div><small>SU HISTORIA EN CONSTRUCCIÓN</small><b>{doneCount} de {modules.length} actividades con timbre CHIPPA</b><div className="progress-track"><span style={{ width: `${Math.min(100, doneCount / modules.length * 100)}%` }} /></div></div><button onClick={() => onPage('capsule')}>Ver cápsula <span>→</span></button></section>
  </main>;
}

function ResultsPage({ state, onOpen, onBack, update }) {
  const people = state.participants || [];
  const tiles = [
    { id: 'same', title: '¿Pensamos lo mismo?', field: 'same' },
    { id: 'story', title: 'Completa nuestra historia', field: 'stories' },
    { id: 'trivia', title: 'Trivia post-cita', field: 'trivia' },
    { id: 'moment', title: 'Nuestro momento', field: 'moment' }
  ];
  return <main className="content results-page"><button className="back-link" onClick={onBack}>← Volver a la aventura</button><div className="eyebrow">DOS PERSPECTIVAS, UNA HISTORIA</div><h1>Descubramos nuestras respuestas.</h1><p className="page-lede">Cuando las dos personas terminen y decidan compartir, este espacio reúne lo que vivieron.</p><div className="result-unlock-banner"><span>✧</span><div><b>¡Llegó el momento de descubrir qué pensaron!</b><small>Sin puntajes de compatibilidad. Solo historias que se encuentran.</small></div></div>
    <div className="results-list">{tiles.map((tile, index) => {
      const values = people.map((person) => state.memberData?.[person.id]?.[tile.field]);
      const summaries = values.map((value) => {
        if (tile.field === 'moment') return value?.ready && value?.share ? value.favorite : '';
        const entries = Object.values(value || {}).filter((answer) => answer?.share);
        return entries.map((answer) => answer.value || answer.text || answer.response || '').filter(Boolean).slice(0, 2).join(' · ');
      });
      const ready = summaries.every(Boolean);
      return <section key={tile.id} className="result-tile"><div className={`result-number result-n-${index}`}>0{index + 1}</div><div className="result-main"><h2>{tile.title}</h2>{ready ? <div className="result-quotes">{people.map((person, personIndex) => <p key={person.id}><span><Avatar value={person.avatar} /> {person.name}</span><b>{summaries[personIndex]}</b></p>)}</div> : <p>Falta que ambas personas respondan y acepten compartir.</p>}</div><div className={`status-tag ${ready ? 'ready' : ''}`}>{ready ? 'Revelado' : 'Esperando'}</div><button className="activity-arrow" onClick={() => onOpen(tile.id)}>↗</button></section>;
    })}</div><button className="primary-button" onClick={() => onOpen('capsule')}>Guardar momentos en la cápsula →</button>
  </main>;
}

function ExperienceForm({ friend, onClose, onSubmit, busy }) {
  const [form, setForm] = useState({ title: '', date: localDateValue(), place: destinations[0], description: '', emoji: CHISPOSITA_CIRCLE_ICON });
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  const submit = (event) => { event.preventDefault(); onSubmit(form); };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="experience-heading"><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><div className="eyebrow">UN NUEVO CAPÍTULO</div><h2 id="experience-heading">Una cita más para su colección.</h2><div className="meeting-with-friend"><Avatar value={friend.avatar} /><span>Un encuentro con <b>{friend.name}</b></span></div><form onSubmit={submit}><label>Nombre de la experiencia<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Una tarde que se alargó" required /></label><div className="field-row"><label>Fecha<ExperienceDateField value={form.date} onChange={(date) => setForm({ ...form, date })} /></label><label>Emoji<ChispositaEmojiField /></label></div><label>Lugar<select value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })}>{destinations.map((place) => <option key={place}>{place}</option>)}</select></label><label>Descripción opcional<textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><button className="primary-button full-button" disabled={busy}>{busy ? 'Guardando…' : 'Crear pasaporte digital →'}</button></form></section></div>;
}

export { labelDate };
export default App;
