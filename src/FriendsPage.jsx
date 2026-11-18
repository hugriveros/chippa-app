import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { labelDate } from './lib/format.js';
import { inviteFriend, meetingsWithFriend, receiveFriendInvitation, respondFriendRequest, revokeFriendInvitation, sharedInteractions } from './lib/friendsStore.js';

export default function FriendsPage({ person, state, social, loading, error, onRefresh, onNewMeeting, onOpenMeeting, onToast }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [detailTab, setDetailTab] = useState('meetings');
  const initialCode = new URLSearchParams(window.location.search).get('friend') || (() => { try { return window.sessionStorage.getItem('chippa-friend-invite') || ''; } catch { return ''; } })();
  const codeCameFromLink = useRef(Boolean(initialCode));
  const [tab, setTab] = useState(initialCode ? 'requests' : 'friends');
  const [code, setCode] = useState(initialCode);
  const [link, setLink] = useState('');
  const [inviteCode, setInviteCode] = useState('');
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
  const create = (event) => {
    event.preventDefault();
    action(async () => {
      const token = await inviteFriend(person, state.mode, '');
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('friend', token);
      setLink(url.toString());
      setInviteCode(token);
    });
  };
  const receive = (event) => {
    event.preventDefault();
    action(async () => {
      await receiveFriendInvitation(person, state.mode, code);
      setCode('');
      try { window.sessionStorage.removeItem('chippa-friend-invite'); } catch { /* La sesión puede no permitir almacenamiento. */ }
      const url = new URL(window.location.href);
      url.searchParams.delete('friend');
      window.history.replaceState(null, '', url);
      setTab('requests');
      onToast('La solicitud llegó a tus notificaciones. Puedes aceptarla o rechazarla.');
    });
  };
  const respond = (request, accept) => action(async () => {
    await respondFriendRequest(person, state.mode, request.id, accept);
    if (accept) setTab('friends');
    onToast(accept ? `Ahora tú y ${request.sender.name} son amigos.` : 'Solicitud de amistad rechazada.');
  });
  const copyText = async (value, label) => {
    try { await navigator.clipboard.writeText(value); onToast(`${label} copiado.`); }
    catch { onToast('No pudimos copiarlo automáticamente. Selecciona el texto y cópialo.'); }
  };

  useEffect(() => {
    if (!codeCameFromLink.current || new URLSearchParams(window.location.search).has('friend')) return;
    try { if (window.sessionStorage.getItem('chippa-friend-invite')) return; } catch { /* El enlace se puede procesar aunque el almacenamiento esté bloqueado. */ }
    codeCameFromLink.current = false;
    setCode('');
  }, [initialCode]);

  if (friend) return <main className="content friends-page">
    <button className="back-link" onClick={() => setSelected(null)}>← Todos mis amigos</button>
    <section className="friend-detail-hero"><Avatar value={friend.avatar} /><div><div className="eyebrow">SU HISTORIA EN CHIPPA</div><h1>{friend.name}</h1><p>{meetings.length} encuentros · {interactions.length} interacciones compartidas</p></div><button className="primary-button" onClick={() => onNewMeeting(friend)}>Crear encuentro juntos →</button></section>
    <div className="friend-summary"><article><b>{meetings.length}</b><span>Citas y encuentros</span></article><article><b>{interactions.length}</b><span>Recuerdos e interacciones</span></article><article><b>{new Set(meetings.map((meeting) => meeting.experience.place)).size}</b><span>Lugares compartidos</span></article></div>
    <div className="friends-tabs" role="group" aria-label="Detalle del amigo"><button aria-pressed={detailTab === 'meetings'} onClick={() => setDetailTab('meetings')}>Citas</button><button aria-pressed={detailTab === 'interactions'} onClick={() => setDetailTab('interactions')}>Interacciones</button></div>
    {detailTab === 'meetings' ? <div className="friend-meetings">{meetings.map(({ experience }) => <button className="friend-meeting" key={experience.id} onClick={() => onOpenMeeting(experience.id)}><span className="friend-meeting-icon"><img src="/assets/chippa/heart-ticket-icon.png" alt="" /></span><span><small>{labelDate(experience.date)}</small><b>{experience.title}</b><span>{experience.place}</span></span><i>Ver encuentro →</i></button>)}{!meetings.length && <Empty title="Su primer encuentro todavía está por escribirse." text="Cuando creen una cita, aparecerán aquí sus actividades y recuerdos." onClick={() => onNewMeeting(friend)} action="Crear primer encuentro" />}</div> : <div className="friend-timeline"><p className="friend-privacy">Aquí aparecen solo las interacciones compartidas. Sus borradores privados se quedan en cada perfil.</p>{interactions.map((entry) => <article key={`${entry.meeting.id}-${entry.id}`}><span className="timeline-dot">♡</span><div><small>{entry.type} · {entry.meeting.title}</small><p>{entry.text}</p><button className="text-button" onClick={() => onOpenMeeting(entry.meeting.id)}>Abrir encuentro ↗</button></div></article>)}{!interactions.length && <Empty title="Un espacio para todo lo que compartan." text="Las cartas, recuerdos, canciones, planes y juegos compartidos aparecerán después de sus encuentros." />}</div>}
  </main>;

  return <main className="content friends-page">
    <section className="friends-hero"><div><div className="eyebrow">LAS HISTORIAS EMPIEZAN CON ALGUIEN</div><h1>Mis amigos.</h1><p>Conecten primero. Después, creen encuentros y coleccionen recuerdos juntos.</p><button className="primary-button" onClick={() => setTab('requests')}>Invitar a un amigo <span>＋</span></button></div><img src="/assets/chippa/corazones-entrelazados.png" alt="" /></section>
    <div className="friends-toolbar"><div className="friends-tabs" role="group" aria-label="Amigos y solicitudes"><button aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}>Amigos <span>{friends.length}</span></button><button aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}>Solicitudes{incoming.length > 0 && <span className="request-count">{incoming.length}</span>}</button></div>{tab === 'friends' && <input type="search" aria-label="Buscar amigo" placeholder="Buscar por nombre…" value={query} onChange={(event) => setQuery(event.target.value)} />}</div>
    {error && <div className="friends-error" role="alert">{error}<button className="text-button" onClick={onRefresh}>Volver a intentar</button></div>}
    {formError && <p className="form-error" role="alert">{formError}</p>}
    {loading && <p role="status">Buscando sus historias…</p>}

    {tab === 'friends' ? <div className="friends-grid">
      {friends.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())).map((entry) => {
        const encounters = meetingsWithFriend(social.meetings || [], person.id, entry.id);
        return <button className="friend-card" key={entry.id} onClick={() => setSelected(entry.id)}><Avatar value={entry.avatar} /><span><b>{entry.name}</b><small>Conectados en CHIPPA</small><span>{encounters.length ? `${encounters.length} encuentros para recordar` : 'Su primer encuentro los espera'}</span></span><i>Ver su historia →</i></button>;
      })}
      {!friends.length && !loading && !error && <Empty title="Una nueva amistad, muchas historias." text="Comparte un enlace. Cuando la otra persona lo abra, recibirá una solicitud de amistad para aceptar o rechazar." onClick={() => setTab('requests')} action="Invitar a mi primer amigo" />}
      {friends.length > 0 && !friends.some((entry) => entry.name.toLowerCase().includes(query.toLowerCase())) && <p>No encontramos un amigo con ese nombre.</p>}
    </div> : <div className="friend-requests-page">
      <section className="module-panel friend-invite"><div className="eyebrow">INVITA CON UN ENLACE O CÓDIGO</div><h2>Que empiece una nueva amistad.</h2><p>Comparte el enlace o el código. Cuando tu amigo lo abra desde su perfil, verá tu solicitud y podrá decidir si conectarse.</p>
        {!link ? <form onSubmit={create}><button className="primary-button" disabled={busy}>Crear enlace y código →</button></form> : <div className="friend-created-link"><b>Tu invitación está lista</b><label>Enlace<input readOnly value={link} onFocus={(event) => event.target.select()} /></label><div className="invite-copy-actions"><button className="secondary-button" onClick={() => copyText(link, 'Enlace')}>Copiar enlace</button><label>Código<input readOnly value={inviteCode} onFocus={(event) => event.target.select()} /></label><button className="secondary-button" onClick={() => copyText(inviteCode, 'Código')}>Copiar código</button></div><p>El enlace y el código vencen en 7 días y sirven una sola vez.</p></div>}
      </section>

      <section className={`friend-accept module-panel ${code ? 'friend-accept-highlight' : ''}`}><div><div className="eyebrow">¿TE COMPARTIERON UNA INVITACIÓN?</div><h2>Revisa la solicitud.</h2><p>Al continuar, aparecerá en tus solicitudes para que la aceptes o la rechaces.</p></div><form onSubmit={receive}><label>Enlace o código<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Pega aquí la invitación" required /></label><button className="secondary-button" disabled={busy || loading || !code.trim()}>Recibir solicitud</button></form></section>

      <section className="friend-request-list"><div className="friend-list-heading"><div><div className="eyebrow">TU BANDEJA</div><h2>Solicitudes de amistad</h2></div>{incoming.length > 0 && <span className="request-count request-count-large">{incoming.length} nueva{incoming.length === 1 ? '' : 's'}</span>}</div>
        {incoming.map((request) => <article className="friend-request-card" key={request.id}><Avatar value={request.sender.avatar} /><div className="friend-request-copy"><b>{request.sender.name}</b><span>quiere conectar contigo</span><small>{new Date(request.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}</small></div><div className="friend-request-actions"><button className="primary-button" disabled={busy} onClick={() => respond(request, true)}>Aceptar</button><button className="text-button" disabled={busy} onClick={() => respond(request, false)}>Rechazar</button></div></article>)}
        {!incoming.length && !loading && <p className="friend-request-empty">No tienes solicitudes pendientes.</p>}
      </section>

      {!!outgoing.length && <section className="friend-request-list outgoing-requests"><div className="friend-list-heading"><div><div className="eyebrow">ENVIADAS</div><h2>Solicitudes que compartiste</h2></div></div>{outgoing.map((request) => <article key={request.id}><Avatar value={request.recipient.avatar} /><div className="friend-request-copy"><b>{request.recipient.name}</b><span>{request.status === 'pending' ? 'Solicitud pendiente' : request.status === 'accepted' ? 'Ya son amigos' : 'Solicitud rechazada'}</span></div><small>{new Date(request.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}</small></article>)}</section>}

      {!!social.invitations?.length && <details className="shared-invitations"><summary>Enlaces creados anteriormente</summary><div className="invitation-list">{social.invitations.map((entry) => {
        const status = entry.revokedAt ? 'Cancelada' : new Date(entry.expiresAt) <= new Date() ? 'Vencida' : entry.requestStatus === 'pending' ? 'Solicitud pendiente' : entry.requestStatus === 'accepted' ? 'Amistad confirmada' : entry.requestStatus === 'declined' ? 'Solicitud rechazada' : entry.acceptedAt ? 'Enlace utilizado' : 'Enlace activo';
        return <article key={entry.id}><div><b>{entry.label || 'Invitación de amistad'}</b><small>{status}</small></div>{status === 'Enlace activo' && <button className="text-button" disabled={busy} onClick={() => action(async () => { await revokeFriendInvitation(person, state.mode, entry.id); onToast('Enlace cancelado.'); })}>Cancelar enlace</button>}</article>;
      })}</div></details>}
    </div>}
  </main>;
}

export function Empty({ title, text, action, onClick }) {
  return <section className="friends-empty"><img src="/assets/chippa/mapa-pin.png" alt="" /><h2>{title}</h2><p>{text}</p>{onClick && <button className="primary-button" onClick={onClick}>{action} →</button>}</section>;
}
