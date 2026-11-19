import { useState } from 'react';
import { modules } from './data.js';
import CompletionStamp from './CompletionStamp.jsx';
import { activityStatus } from './lib/activityStatus.js';

export const gameDetails = {
  moment: { label: 'REVIVAN LA CITA', time: '5 min', action: 'Guardar mi recuerdo', art: '📷' },
  letters: { label: 'UNA CARTA PARA DOS', time: 'A su ritmo', action: 'Abrir una carta', art: '💌' },
  next: { label: 'SU PRÓXIMO CAPÍTULO', time: '5 min', action: 'Elegir una aventura', art: '🧭' },
  questions: { label: 'SIGAN CONOCIÉNDOSE', time: 'A su ritmo', action: 'Descubrir una pregunta', art: '💭', image: '/assets/chippa/chat-bubble.png' },
  passport: { label: 'SU COLECCIÓN', time: 'Todos sus lugares', action: 'Abrir el pasaporte', art: '🛂' },
  capsule: { label: 'PARA ATESORAR', time: 'A su ritmo', action: 'Guardar recuerdos', art: '📷', image: '/assets/chippa/capsule-camera.png' },
  future: { label: 'PARA SU YO DEL FUTURO', time: '5 min', action: 'Escribir una carta', art: '⏳', image: '/assets/chippa/heart-ticket-icon.png' },
  playlist: { label: 'SU BANDA SONORA', time: 'A su ritmo', action: 'Crear su playlist', art: '🎧' },
  plans: { label: 'DEJEN QUE LOS SORPRENDA', time: '2 min', action: 'Descubrir un plan', art: '🎲' },
  same: { label: 'DOS VERSIONES', time: '5 min', action: 'Descubrir coincidencias', art: '✨' },
  story: { label: 'IMAGINACIÓN', time: '5 min', action: 'Escribir juntos', art: '✍️' },
  memory: { label: 'MEMORIA', time: '3 min', action: 'Encontrar parejas', art: '🃏' },
  missions: { label: 'DESAFÍOS', time: 'A su ritmo', action: 'Ver misiones', art: '⭐' },
  trivia: { label: 'DOS MIRADAS', time: '4 min', action: 'Recordar la cita', art: '🎯' },
  'memory-bingo': { label: 'PEQUEÑOS MOMENTOS', time: '5 min', action: 'Completar el bingo', art: '🎟️' },
  'couple-quiz': { label: 'CONÓZCANSE', time: '5 min', action: 'Descubrir sus gustos', art: '💭' },
  'guess-the-place': { label: 'EXPLORACIÓN', time: '3 min', action: 'Seguir las pistas', art: '🗺️' }
};

export function LockIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="4.5" y="8.5" width="11" height="9" rx="2" /><path d="M7 8.5V6a3 3 0 0 1 6 0v2.5M10 12v2" /></svg>;
}

export function ActivityCard({ item, state, onOpen, premiumActive = false }) {
  const detail = gameDetails[item.id];
  const locked = item.premium && !premiumActive;
  const completed = activityStatus(state, item.id);
  const isGame = item.group === 'Juegos';
  const session = state.shared?.game?.memorySession;
  const member = state.memberData?.[state.activeUserId] || {};
  const started = item.id === 'memory' ? session?.attempts > 0 : item.id === 'trivia' ? Object.keys(member.trivia || {}).length > 0 : item.id === 'missions' ? state.shared?.missions?.length > 0 : item.id === 'moment' ? member.moment?.ready : item.id === 'letters' ? member.letters?.length > 0 : item.id === 'questions' ? member.questions?.length > 0 : false;
  const image = item.art || detail.image;
  return <button type="button" className={`play-card tone-${item.tone} ${locked ? 'play-card-premium' : ''} ${completed ? 'activity-completed' : ''}`} onClick={() => onOpen(item.id)} aria-label={`${item.title}, ${locked ? 'Premium, bloqueado' : item.premium ? 'Premium activo' : 'gratis'}${completed ? ', completada' : ''}`}>
    <span className="play-card-top"><span>{detail.label}</span><span className={`play-access ${item.premium ? 'paid' : ''}`}>{item.premium ? <>{locked && <LockIcon />} Premium</> : 'Free'}</span></span>
    <span className="play-card-art" aria-hidden="true"><i>✦</i><span>{image ? <img src={image} alt="" /> : detail.art}</span><i>♡</i></span>
    <span className="play-card-title">{item.title}</span>
    <span className="play-card-desc">{item.desc}</span>{completed && <CompletionStamp compact />}
    <span className="play-card-bottom"><small>{detail.time}{isGame ? ` · ${item.id === 'memory' ? 'Solo o por turnos' : 'Para dos'}` : ''}</small><b className="play-card-action">{locked ? <><LockIcon /> Desbloquear</> : <>{completed ? 'Volver a abrir' : started ? 'Continuar' : isGame ? 'Jugar' : detail.action} <span>→</span></>}</b></span>
  </button>;
}

export default function GamesHub({ state, onOpen, onBack, backLabel = 'Volver al inicio', initialFilter = 'Todos', premiumActive = false }) {
  const [filter, setFilter] = useState(initialFilter);
  const games = modules.filter((item) => item.group === 'Juegos');
  const shown = games.filter((item) => filter === 'Todos' || (filter === 'Free' ? !item.premium : item.premium));
  return <main className="content games-hub"><button className="back-link" onClick={onBack}>← {backLabel}</button>
    <section className="games-intro"><div><div className="eyebrow">{state.experience.title}</div><h1>Juegos de la salida</h1></div><div className="games-intro-art" aria-hidden="true">🎲<span>♡</span><i>✦</i></div></section>
    <div className="games-toolbar"><div role="group" aria-label="Filtrar juegos">{['Todos', 'Free', 'Premium'].map((label) => <button key={label} aria-pressed={filter === label} className={filter === label ? 'selected' : ''} onClick={() => setFilter(label)}>{label === 'Premium' && <LockIcon />}{label}</button>)}</div><span>{shown.length} juegos para descubrir</span></div>
    <div className="games-library">{shown.map((item) => <ActivityCard premiumActive={premiumActive} key={item.id} item={item} state={state} onOpen={onOpen} />)}</div>
  </main>;
}
