import { useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar.jsx';
import { labelDate } from './lib/format.js';
import { meetingsWithFriend, respondFriendRequest, searchFriendProfiles, sendFriendRequest, sharedInteractions } from './lib/friendsStore.js';

export default function FriendsPage({ person, state, social, loading, error, onRefresh, onNewMeeting, onOpenMeeting, onToast }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [profileResults, setProfileResults] = useState([]);
  const [searchingProfiles, setSearchingProfiles] = useState(false);
  const [profileSearchError, setProfileSearchError] = useState('');
  const [detailTab, setDetailTab] = useState('meetings');
  const [tab, setTab] = useState('friends');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const friends = social.connections || [];
  const requests = social.requests || [];
  const incoming = requests.filter((request) => request.recipientId === person.id && request.status === 'pending');
  const outgoing = requests.filter((request) => request.senderId === person.id);
  const friend = friends.find((entry) => entry.id === selected);
  const meetings = useMemo(() => friend ? meetingsWithFriend(social.meetings || [], person.id, friend.id) : [], [social.meetings, friend, person.id]);
  const interactions = meetings.flatMap((meeting) => sharedInteractions(meeting).map((entry) => ({ ...entry, meeting: meeting.experience })));

  const action = async (fn) => {
    setBusy(true);
    setFormError('');
    try { await fn(); await onRefresh(); }
    catch (failure) { setFormError(failure.message || 'No pudimos completar la acción. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };
  const addFriend = (profile) => action(async () => {
    await sendFriendRequest(state.mode, profile.id);
    onToast(`Solicitud enviada a ${profile.name}.`);
  });
  const respond = (request, accept) => action(async () => {
    await respondFriendRequest(person, state.mode, request.id, accept);
    if (accept) setTab('friends');
    onToast(accept ? `Ahora tú y ${request.sender.name} son amigos.` : 'Solicitud de amistad rechazada.');
  });
  useEffect(() => {
    const term = profileSearch.trim();
    if (term.length < 2) {
      setProfileResults([]);
      setSearchingProfiles(false);
      setProfileSearchError('');
      return undefined;
    }
    let active = true;
    setSearchingProfiles(true);
    setProfileSearchError('');
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchFriendProfiles(state.mode, term);
        if (active) setProfileResults(results);
      } catch (failure) {
        if (active) setProfileSearchError(failure.message || 'No pudimos buscar perfiles. Intenta nuevamente.');
      } finally {
        if (active) setSearchingProfiles(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [profileSearch, state.mode]);

  if (friend) return <main className="content friends-page">
    <button className="back-link" onClick={() => setSelected(null)}>← Todos mis amigos</button>
    <section className="friend-detail-hero"><Avatar value={friend.avatar} /><div><div className="eyebrow">SU HISTORIA EN CHIPPA</div><h1>{friend.name}</h1><p>{meetings.length} encuentros · {interactions.length} interacciones compartidas</p></div><button className="primary-button" onClick={() => onNewMeeting(friend)}>Crear encuentro juntos →</button></section>
    <div className="friend-summary"><article><b>{meetings.length}</b><span>Citas y encuentros</span></article><article><b>{interactions.length}</b><span>Recuerdos e interacciones</span></article><article><b>{new Set(meetings.map((meeting) => meeting.experience.place)).size}</b><span>Lugares compartidos</span></article></div>
    <div className="friends-tabs" role="group" aria-label="Detalle del amigo"><button aria-pressed={detailTab === 'meetings'} onClick={() => setDetailTab('meetings')}>Citas</button><button aria-pressed={detailTab === 'interactions'} onClick={() => setDetailTab('interactions')}>Interacciones</button></div>
    {detailTab === 'meetings' ? <div className="friend-meetings">{meetings.map(({ experience }) => <button className="friend-meeting" key={experience.id} onClick={() => onOpenMeeting(experience.id)}><span className="friend-meeting-icon"><img src="/assets/chippa/heart-ticket-icon.png" alt="" /></span><span><small>{labelDate(experience.date)}</small><b>{experience.title}</b><span>{experience.place}</span></span><i>Ver encuentro →</i></button>)}{!meetings.length && <Empty title="Su primer encuentro todavía está por escribirse." text="Cuando creen una cita, aparecerán aquí sus actividades y recuerdos." onClick={() => onNewMeeting(friend)} action="Crear primer encuentro" />}</div> : <div className="friend-timeline"><p className="friend-privacy">Aquí aparecen solo las interacciones compartidas. Sus borradores privados se quedan en cada perfil.</p>{interactions.map((entry) => <article key={`${entry.meeting.id}-${entry.id}`}><span className="timeline-dot">♡</span><div><small>{entry.type} · {entry.meeting.title}</small><p>{entry.text}</p><button className="text-button" onClick={() => onOpenMeeting(entry.meeting.id)}>Abrir encuentro ↗</button></div></article>)}{!interactions.length && <Empty title="Un espacio para todo lo que compartan." text="Las cartas, recuerdos, canciones, planes y juegos compartidos aparecerán después de sus encuentros." />}</div>}
  </main>;

  return <main className="content friends-page">
    <section className="friends-hero"><div><div className="eyebrow">LAS HISTORIAS EMPIEZAN CON ALGUIEN</div><h1>Mis amigos.</h1><p>Conecten primero. Después, creen encuentros y coleccionen recuerdos juntos.</p><button className="primary-button" onClick={() => setTab('requests')}>Agregar amigo <span>＋</span></button></div><img src="/assets/chippa/corazones-entrelazados.png" alt="" /></section>
    <div className="friends-toolbar"><div className="friends-tabs" role="group" aria-label="Amigos y solicitudes"><button aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>Amigos <span>{friends.length}</span></button><button aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}>Solicitudes{incoming.length > 0 && <span className="request-count">{incoming.length}</span>}</button></div>{tab === 'friends' && <input type="search" aria-label="Buscar amigo" placeholder="Buscar por nombre…" value={query} onChange={(event) => setQuery(event.target.value)} />}</div>
    {error && <div className="friends-error" role="alert">{error}<button className="text-button" onClick={onRefresh}>Volver a intentar</button></div>}
    {formError && <p className="form-error" role="alert">{formError}</p>}
    {loading && <p role="status">Buscando sus historias…</p>}

    {tab === 'friends' ? <div className="friends-grid">
      {friends.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())).map((entry) => {
        const encounters = meetingsWithFriend(social.meetings || [], person.id, entry.id);
        return <button className="friend-card" key={entry.id} onClick={() => setSelected(entry.id)}><Avatar value={entry.avatar} /><span><b>{entry.name}</b><small>Conectados en CHIPPA</small><span>{encounters.length ? `${encounters.length} encuentros para recordar` : 'Su primer encuentro los espera'}</span></span><i>Ver su historia →</i></button>;
      })}
      {!friends.length && !loading && !error && <Empty title="Una nueva amistad, muchas historias." text="Busca el perfil de tu amigo y envíale una solicitud. Cuando la acepte, podrán crear encuentros juntos." onClick={() => setTab('requests')} action="Agregar a un amigo" />}
      {friends.length > 0 && !friends.some((entry) => entry.name.toLowerCase().includes(query.toLowerCase())) && <p>No encontramos un amigo con ese nombre.</p>}
    </div> : <div className="friend-requests-page">
      <section className="module-panel friend-invite"><div className="eyebrow">ENCUENTRA A TU AMIGO</div><h2>Envía una solicitud directa.</h2><p>Busca su perfil por nombre. La solicitud aparecerá en sus notificaciones para que pueda aceptarla o rechazarla.</p>
        <label className="friend-profile-search">Nombre del perfil<input type="search" value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Escribe al menos 2 caracteres" disabled={state.mode !== 'cloud'} /></label>
        {state.mode !== 'cloud' && <p>Inicia sesión para buscar perfiles y enviar solicitudes de amistad.</p>}
        {profileSearchError && <p className="form-error" role="alert">{profileSearchError}</p>}
        {searchingProfiles && <p role="status">Buscando perfiles…</p>}
        {profileSearch.trim().length >= 2 && !searchingProfiles && !profileSearchError && <div className="friend-profile-results">
          {profileResults.map((profile) => {
            const alreadyFriend = friends.some((entry) => entry.id === profile.id);
            const alreadySent = outgoing.some((request) => request.recipientId === profile.id && request.status === 'pending');
            const received = incoming.some((request) => request.senderId === profile.id);
            return <article className="friend-profile-result" key={profile.id}><Avatar value={profile.avatar} /><div><b>{profile.name}</b><span>Perfil CHIPPA</span></div>
              {alreadyFriend ? <span className="friend-profile-status">Ya son amigos</span> : alreadySent ? <span className="friend-profile-status">Solicitud enviada</span> : received ? <span className="friend-profile-status">Te envió una solicitud</span> : <button className="primary-button" disabled={busy} onClick={() => addFriend(profile)}>Enviar solicitud</button>}
            </article>;
          })}
          {!profileResults.length && <p className="friend-request-empty">No encontramos perfiles con ese nombre.</p>}
        </div>}
      </section>

      <section className="friend-request-list"><div className="friend-list-heading"><div><div className="eyebrow">TU BANDEJA</div><h2>Solicitudes de amistad</h2></div>{incoming.length > 0 && <span className="request-count request-count-large">{incoming.length} nueva{incoming.length === 1 ? '' : 's'}</span>}</div>
        {incoming.map((request) => <article className="friend-request-card" key={request.id}><Avatar value={request.sender.avatar} /><div className="friend-request-copy"><b>{request.sender.name}</b><span>quiere conectar contigo</span><small>{new Date(request.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}</small></div><div className="friend-request-actions"><button className="primary-button" disabled={busy} onClick={() => respond(request, true)}>Aceptar</button><button className="text-button" disabled={busy} onClick={() => respond(request, false)}>Rechazar</button></div></article>)}
        {!incoming.length && !loading && <p className="friend-request-empty">No tienes solicitudes pendientes.</p>}
      </section>

      {!!outgoing.length && <section className="friend-request-list outgoing-requests"><div className="friend-list-heading"><div><div className="eyebrow">ENVIADAS</div><h2>Solicitudes enviadas</h2></div></div>{outgoing.map((request) => <article key={request.id}><Avatar value={request.recipient.avatar} /><div className="friend-request-copy"><b>{request.recipient.name}</b><span>{request.status === 'pending' ? 'Solicitud pendiente' : request.status === 'accepted' ? 'Ya son amigos' : 'Solicitud rechazada'}</span></div><small>{new Date(request.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}</small></article>)}</section>}

    </div>}
  </main>;
}

export function Empty({ title, text, action, onClick }) {
  return <section className="friends-empty"><img src="/assets/chippa/mapa-pin.png" alt="" /><h2>{title}</h2><p>{text}</p>{onClick && <button className="primary-button" onClick={onClick}>{action} →</button>}</section>;
}
