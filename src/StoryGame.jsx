import { storyPrompts } from './data.js';
import Avatar from './Avatar.jsx';
import CompletionStamp from './CompletionStamp.jsx';

export default function StoryGame({ state, update, updateMember, currentUser, partner, currentMember, onToast }) {
  const index = state.shared?.game?.storyIndex || 0;
  const page = index % storyPrompts.length;
  const complete = state.shared?.game?.storyFinished;
  const response = currentMember.stories?.[index] || {};
  const other = state.memberData?.[partner?.id]?.stories?.[index];
  const solo = !partner;
  const both = solo ? Boolean(response.text?.trim()) : Boolean(response.text?.trim() && response.share && other?.text?.trim() && other.share);
  const set = (key, value) => updateMember((member) => ({ ...member, stories: { ...member.stories, [index]: { ...member.stories?.[index], [key]: value } } }));
  const advance = () => { if (!both) return; update((before) => ({ ...before, shared: { ...before.shared, game: { ...before.shared.game, storyIndex: page === storyPrompts.length - 1 ? index : index + 1, storyFinished: page === storyPrompts.length - 1 } } })); };
  const savePage = () => {
    const id = `story-${index}-${currentUser.id}`;
    const story = partner ? `${storyPrompts[page]}\n${currentUser.name}: ${response.text}\n${partner.name}: ${other.text}` : `${storyPrompts[page]}\n${currentUser.name}: ${response.text}`;
    update((before) => ({ ...before, shared: { ...before.shared, memories: [{ id, ownerId: currentUser.id, ownerName: currentUser.name, ownerAvatar: currentUser.avatar, text: story, type: 'note', shared: true, createdAt: new Date().toISOString() }, ...(before.shared.memories || []).filter((entry) => entry.id !== id)] } }));
    onToast(partner ? 'Página guardada en la cápsula compartida.' : 'Página guardada en tu cápsula.');
  };
  if (complete) return <section className="module-panel round-complete"><CompletionStamp /><h2>Su historia ya tiene un capítulo más.</h2><p>Las {storyPrompts.length} páginas se guardaron en su experiencia.</p><button className="primary-button" onClick={() => update((before) => ({ ...before, shared: { ...before.shared, game: { ...before.shared.game, storyIndex: index + 1, storyFinished: false } } }))}>Escribir otra historia ↻</button></section>;
  return <div className="module-layout two-column"><section className="module-panel story-page"><div className="eyebrow">PÁGINA {page + 1} DE {storyPrompts.length}</div><h2>{storyPrompts[page]}</h2><textarea className="lined-textarea" rows="5" value={response.text || ''} onChange={(event) => set('text', event.target.value)} placeholder="Completa la frase a tu manera…" /><label className="simulation-consent"><input type="checkbox" checked={Boolean(response.share)} onChange={(event) => set('share', event.target.checked)} />{solo ? 'Guardar esta página en mi salida' : 'Compartir esta página cuando ambas versiones estén listas'}</label><button className="primary-button" disabled={!both} onClick={advance}>{page === storyPrompts.length - 1 ? 'Terminar historia' : 'Siguiente página'} →</button></section><section className="module-panel story-aside"><div className="eyebrow">{solo ? 'TU HISTORIA' : 'DOS VOCES, UNA HISTORIA'}</div>{both ? <><h3>{solo ? 'Así completaste esta página.' : 'Así recordaron este momento.'}</h3>{[[currentUser,response],[partner,other]].filter(([person]) => person).map(([person, entry]) => <article className="story-version" key={person.id}><span><Avatar value={person.avatar} /> {person.name}</span><p>{entry.text}</p></article>)}<button className="secondary-button" onClick={savePage}>Guardar página en la cápsula ♡</button></> : <><h3>{solo ? 'Tu página empieza aquí.' : 'La otra versión todavía se está escribiendo.'}</h3><p>{solo ? 'Tu borrador se guarda mientras escribes.' : 'Tu borrador se guarda al escribir. Activa compartir cuando esté listo.'}</p></>}{state.mode === 'demo' && import.meta.env.DEV && partner && <button className="secondary-button full-button" onClick={() => update((before) => ({ ...before, activeUserId: partner.id }))}>Responder como {partner.name} ⇄</button>}</section></div>;
}
