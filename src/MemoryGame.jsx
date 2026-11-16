import { useEffect, useRef } from 'react';
import { memorySelection, shuffled } from './lib/gameLogic.js';
import Avatar from './Avatar.jsx';

const symbols = [
  ['camera', '📷', 'Foto'], ['music', '🎵', 'Canción'], ['map', '🗺️', 'Lugar'], ['heart', '💗', 'Momento'],
  ['coffee', '☕', 'Café'], ['star', '⭐', 'Sorpresa'], ['flower', '🌷', 'Detalle'], ['sun', '🌤️', 'Tarde']
];
export function createMemorySession(pairCount = 4, mode = 'individual') {
  return { pairCount, mode, cards: shuffled(symbols.slice(0, pairCount).flatMap(([pair, symbol, label]) => [{ id: `${pair}-icon`, pair, symbol, label, face: 'icon' }, { id: `${pair}-word`, pair, symbol, label, face: 'word' }])), flipped: [], matched: [], attempts: 0, turns: 0 };
}

export default function MemoryGame({ state, update }) {
  const session = state.shared?.game?.memorySession;
  const initial = useRef(null);
  if (!initial.current) initial.current = createMemorySession();
  const current = session || initial.current;
  const { pairCount, mode, cards, flipped, matched, attempts, turns } = current;
  const finished = matched.length === cards.length;
  const participants = state.participants || [];
  const active = participants[turns % Math.max(participants.length, 1)];
  const changeSession = (transform) => update((previous) => {
    const before = previous.shared?.game?.memorySession || initial.current;
    const next = transform(before);
    if (next === before) return previous;
    const done = next.matched.length === next.cards.length;
    const bests = previous.shared?.game?.memoryBests || {};
    const best = bests[next.pairCount];
    return { ...previous, shared: { ...previous.shared, game: { ...previous.shared?.game, memorySession: next, ...(done ? { matchedPairs: next.pairCount, memoryBests: { ...bests, [next.pairCount]: best ? Math.min(best, next.attempts) : next.attempts } } : {}) } } };
  });
  useEffect(() => {
    if (flipped.length !== 2) return undefined;
    const pending = flipped.join('|');
    const timer = window.setTimeout(() => changeSession((before) => before.flipped.join('|') === pending ? { ...before, flipped: [], turns: before.turns + 1 } : before), 1000);
    return () => window.clearTimeout(timer);
  }, [flipped.join('|'), update]);
  const restart = (pairs = pairCount, nextMode = mode) => { const next = createMemorySession(pairs, nextMode); changeSession(() => next); };
  return <div className="module-layout two-column memory-play-layout">
    <section className="module-panel memory-board-panel">
      <div className="memory-controls"><div><div className="eyebrow">CADA PAREJA, UN RECUERDO</div><h2>Encuentren su match.</h2></div><div className="mini-pair button-pair"><label>Dificultad<select value={pairCount} onChange={(event) => restart(Number(event.target.value))}><option value="4">Fácil · 4 pares</option><option value="6">Medio · 6 pares</option><option value="8">Desafío · 8 pares</option></select></label><label>Modo<select value={mode} onChange={(event) => restart(pairCount, event.target.value)}><option value="individual">Individual</option><option value="turnos">Por turnos</option></select></label></div></div>
      <div className="memory-stats"><span><b>{attempts}</b>Intentos</span><span><b>{matched.length / 2}<small> / {pairCount}</small></b>Pares encontrados</span><span><b>{state.shared?.game?.memoryBests?.[pairCount] || '—'}</b>Mejor partida</span></div>
      <div className="memory-turn" role="status">{finished ? '✦ ¡Todos los recuerdos encontraron su pareja!' : mode === 'turnos' ? <><Avatar value={active?.avatar} /> Turno de {active?.name || 'ustedes'} · compartan el dispositivo</> : 'Une cada imagen con su palabra. Puedes tomarte tu tiempo.'}</div>
      <div className={`memory-grid size-${pairCount}`}>{cards.map((card) => {
        const paired = matched.includes(card.id);
        const visible = flipped.includes(card.id) || paired;
        return <button key={card.id} className={`memory-card ${visible ? 'flipped' : ''} ${paired ? 'matched' : ''}`} disabled={paired || flipped.length === 2} aria-pressed={visible} aria-label={visible ? card.label : 'Revelar carta'} onClick={() => changeSession((before) => memorySelection(before, card.id))}><span className="memory-card-face">{visible ? <>{card.face === 'icon' ? <span>{card.symbol}</span> : <b>{card.label}</b>}{paired && <small className="memory-paired-check">✓</small>}</> : <span className="card-back">✦<small>CHIPPA</small></span>}</span></button>;
      })}</div>
      {finished && <div className="memory-win" role="status"><span>🎉</span><b>¡Una partida para la colección!</b><small>{pairCount} pares en {attempts} intentos.</small><button className="primary-button" onClick={() => restart()}>Volver a jugar ↻</button></div>}
    </section>
    <aside className="module-panel game-aside"><span className="game-guide-icon">♡</span><div className="eyebrow">ASÍ SE JUEGA</div><h3>Las cosas pequeñas<br />hacen una gran pareja.</h3><ol className="game-guide"><li>Da vuelta dos cartas.</li><li>Une la imagen con su palabra.</li><li>Si no coinciden, recuerda su lugar y vuelve a intentar.</li></ol><div className="memory-match-example"><span>📷</span><i>♡</i><b>Foto</b></div><p>Tu partida se guarda al jugar. Puedes salir y continuar después.</p><button className="secondary-button full-button" onClick={() => restart()}>Nueva partida ↻</button></aside>
  </div>;
}
