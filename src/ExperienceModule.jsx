import StoryGame from './StoryGame.jsx';
import { BingoGame, CoupleQuiz, PlaceGame } from './ExtraGames.jsx';
import CompletionStamp from './CompletionStamp.jsx';
import { activityStatus, completionRecord } from './lib/activityStatus.js';
import Avatar from './Avatar.jsx';
import MemoryGame from './MemoryGame.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  categories, letterDeck, modules, planCatalog, questionBank,
  sameQuestions, storyPrompts, triviaQuestions
} from './data.js';
import { labelDate, localDateValue } from './lib/format.js';
import { useAppState } from './context/AppStateContext.jsx';
import { createCloudFutureLetter, getExperiencePhotoUrl, loadCloudFutureLetters, setExperiencePhotoShared, uploadExperiencePhoto } from './lib/cloudStore.js';

const memoryIcons = [
  { src: '/assets/chippa/memory-ticket-1.png', label: 'Tarjeta de recuerdo 1' },
  { src: '/assets/chippa/memory-ticket-2.png', label: 'Tarjeta de recuerdo 2' },
  { src: '/assets/chippa/memory-ticket-3.png', label: 'Tarjeta de recuerdo 3' },
  { src: '/assets/chippa/memory-ticket-4.png', label: 'Tarjeta de recuerdo 4' },
  { src: '/assets/chippa/memory-ticket-5.png', label: 'Tarjeta de recuerdo 5' },
  { src: '/assets/chippa/memory-ticket-6.png', label: 'Tarjeta de recuerdo 6' },
  { src: '/assets/chippa/memory-ticket-7.png', label: 'Tarjeta de recuerdo 7' },
  { src: '/assets/chippa/memory-ticket-8.png', label: 'Tarjeta de recuerdo 8' }
];
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const formattedNow = () => new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });

function experienceMark(value, fallback = '✦') {
  const mark = value || fallback;
  return typeof mark === 'string' && mark.startsWith('/assets/chippa/')
    ? <img className="experience-mark-image" src={mark} alt="" />
    : mark;
}

function patchRecord(updateMember, key, value) {
  updateMember((member) => ({ ...member, [key]: typeof value === 'function' ? value(member[key]) : value }));
}

export default function ExperienceModule({ moduleId, state, update, updateMember, currentUser, partner, currentMember, onBack, onNavigate, onToast }) {
  const completeActivity = () => updateMember((member) => completionRecord(member, [moduleId]));
  const completed = activityStatus(state, moduleId);
  const definition = modules.find((module) => module.id === moduleId);
  return <main className="content module-page">
    <button className="back-link" onClick={onBack}>← Volver a la aventura</button>
    <div className="module-heading"><span className="module-heading-emoji">{moduleId === 'capsule' ? <img src="/assets/chippa/capsule-camera.png" alt="" /> : moduleId === 'moment' ? <img src="/assets/chippa/heart-ticket-icon.png" alt="" /> : moduleId === 'letters' && definition?.art ? <img src={definition.art} alt="" /> : moduleId === 'next' && definition?.art ? <img src={definition.art} alt="" /> : (definition?.emoji || '✦')}</span><div><div className="eyebrow">{definition?.group?.toUpperCase() || 'SU RECUERDO'}</div><h1>{definition?.title || 'Su historia'}</h1><p>{definition?.desc || 'Guarden los momentos que quieran compartir.'}</p></div></div>
    {completed && <div className="activity-finish-banner"><CompletionStamp /><div><b>Un recuerdo más en su colección.</b><p>Esta actividad ya tiene su timbre de CHIPPA.</p></div></div>}
    {moduleId === 'moment' && <MomentModule {...{ state, update, updateMember, currentUser, partner, currentMember, onToast }} />}
    {moduleId === 'letters' && <LettersModule {...{ state, update, updateMember, currentUser, currentMember, onToast }} />}
    {moduleId === 'memory-bingo' && <BingoGame {...{ currentMember, updateMember }} />}
    {moduleId === 'couple-quiz' && <CoupleQuiz {...{ currentMember, updateMember, partner }} />}
    {moduleId === 'guess-the-place' && <PlaceGame {...{ currentMember, updateMember }} />}
    {moduleId === 'next' && <NextAdventure {...{ state, update, updateMember, currentUser, partner, currentMember, onToast }} />}
    {moduleId === 'same' && <QuestionGame game="same" {...{ state, update, updateMember, currentUser, partner, currentMember, onToast }} />}
    {moduleId === 'story' && <StoryGame {...{ state, update, updateMember, currentUser, partner, currentMember, onToast }} />}
    {moduleId === 'trivia' && <QuestionGame game="trivia" {...{ state, update, updateMember, currentUser, partner, currentMember, onToast }} />}
    {moduleId === 'memory' && <MemoryGame {...{ state, update, onToast }} />}
    {moduleId === 'missions' && <MissionsModule {...{ state, update, currentUser, onNavigate }} />}
    {moduleId === 'questions' && <QuestionBankModule {...{ state, updateMember, currentUser, currentMember, onToast }} />}
    {moduleId === 'passport' && <PassportModule {...{ state, currentUser, partner, completeActivity }} />}
    {moduleId === 'capsule' && <CapsuleModule {...{ state, update, currentUser, currentMember, partner, onToast }} />}
    {moduleId === 'future' && <FutureLetters {...{ state, updateMember, completeActivity, currentUser, currentMember, onToast }} />}
    {moduleId === 'playlist' && <PlaylistModule {...{ state, update, updateMember, currentUser, onToast }} />}
    {moduleId === 'plans' && <PlanGenerator {...{ state, update, updateMember, currentUser, partner, currentMember, onToast }} />}
  </main>;
}

function Panel({ children, className = '' }) { return <section className={`module-panel ${className}`}>{children}</section>; }
function ParticipantPair({ first, second }) { return <div className="participant-pair"><span><Avatar value={first?.avatar} /> {first?.name}</span><i>+</i><span><Avatar value={second?.avatar} /> {second?.name || 'Acompañante'}</span></div>; }
function ShareToggle({ checked, onChange, label = 'Quiero compartir esta respuesta cuando ambos terminemos' }) {
  return <label className="share-toggle"><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-track" /><span>{label}</span></label>;
}
function Photo({ item, alt = 'Recuerdo compartido' }) {
  const [src, setSrc] = useState(typeof item === 'string' ? item : item?.data || '');
  useEffect(() => {
    let active = true;
    setSrc(typeof item === 'string' ? item : item?.data || '');
    if (item?.path) getExperiencePhotoUrl(item.path).then((url) => { if (active) setSrc(url); }).catch(() => { if (active) setSrc(''); });
    return () => { active = false; };
  }, [item]);
  return src ? <img className="memory-photo" src={src} alt={alt} /> : null;
}

function MomentModule({ state, update, updateMember, currentUser, partner, currentMember, onToast }) {
  const moment = currentMember.moment || {};
  const solo = !partner;
  const [wordInput, setWordInput] = useState((moment.words || []).join(', '));
  const revealed = (state.participants || []).every((person) => {
    const entry = state.memberData?.[person.id]?.moment;
    return entry?.ready && (solo || entry?.share);
  });
  const set = (field, value) => {
    patchRecord(updateMember, 'moment', (old = {}) => ({ ...old, [field]: value }));
    if (field === 'share' && moment.photo?.path && state.mode === 'cloud') setExperiencePhotoShared(moment.photo.path, value).catch((error) => onToast(error.message || 'No pudimos cambiar el permiso de la foto.'));
  };
  const handlePhoto = async (file) => {
    if (!file) return;
    try {
      if (!file.type.startsWith('image/')) throw new Error('Elige un archivo de imagen.');
      let photo;
      if (state.mode === 'cloud') photo = await uploadExperiencePhoto(file, state.experience.id, currentUser.id);
      else {
        if (file.size > 1200000) throw new Error('La foto debe pesar menos de 1,2 MB.');
        photo = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ data: reader.result }); reader.onerror = reject; reader.readAsDataURL(file); });
      }
      set('photo', photo); onToast('Foto agregada a tu página.');
    } catch (error) { onToast(error.message || 'No pudimos cargar la foto.'); }
  };
  const save = () => {
    const words = wordInput.split(',').map((word) => word.trim()).filter(Boolean).slice(0, 3);
    if (!moment.favorite?.trim()) { onToast('Agrega ese momento que quieres guardar.'); return; }
    set('words', words); set('ready', true); onToast('Tu página ya está lista.');
  };
  return <div className="module-layout two-column">
    <Panel className="scrapbook-panel"><div className="paper-tape" /><div className="scrapbook-date">{labelDate(state.experience?.date)} <span>♡</span></div><div className="eyebrow">{solo ? 'TU MOMENTO' : 'NUESTRO MOMENTO FAVORITO'}</div><h2>{solo ? '¿Qué momento de tu salida quieres guardar?' : 'Si pudieras guardar un solo momento de nuestra cita, ¿cuál sería?'}</h2>
      <textarea className="lined-textarea" value={moment.favorite || ''} onChange={(e) => set('favorite', e.target.value)} placeholder="Ese instante en que…" rows="4" aria-label="Tu momento favorito" />
      <div className="emoji-pick"><span>El emoji de este recuerdo</span><div>{memoryIcons.map((item) => <button type="button" key={item.src} aria-label={item.label} className={moment.emoji === item.src ? 'chosen' : ''} onClick={() => set('emoji', item.src)}><img src={item.src} alt="" /></button>)}</div></div>
      <label className="file-pick">＋ Agregar una foto (opcional)<input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files?.[0])} /><small>Solo se comparte si tú lo decides.</small></label>
      <Photo item={moment.photo} alt="Foto del momento favorito" />
      <label className="plain-label">Nuestra cita en tres palabras<input value={wordInput} onChange={(e) => setWordInput(e.target.value)} placeholder="divertida, inesperada, cálida" /><small>Separa tus tres palabras con comas.</small></label>
    </Panel>
    <div className="module-stack"><Panel><div className="eyebrow">LA BANDA SONORA</div><h3>¿Qué canción te recuerda este momento?</h3><div className="field-pair"><label>Nombre de la canción<input value={moment.song || ''} onChange={(e) => set('song', e.target.value)} placeholder="Una canción" /></label><label>Artista<input value={moment.artist || ''} onChange={(e) => set('artist', e.target.value)} placeholder="Artista" /></label></div><label>Enlace musical (opcional)<input type="url" value={moment.link || ''} onChange={(e) => set('link', e.target.value)} placeholder="https://…" /></label></Panel>
      <Panel className="privacy-panel"><span className="privacy-lock">🔒</span><div><b>Tu respuesta se queda contigo.</b><p>{solo ? 'Tu página queda guardada en esta salida.' : 'Solo aparece aquí cuando ambas personas terminan y aceptan compartir.'}</p></div><ShareToggle checked={moment.share} onChange={(value) => set('share', value)} label={solo ? 'Guardar esta página en mi salida' : 'Acepto compartir esta página'} /><button className="primary-button full-button" onClick={save}>{moment.ready ? 'Actualizar mi página →' : 'Guardar mi página →'}</button></Panel>
    </div>
    <div className="wide-result">{revealed ? <Panel className="revealed-panel"><div className="eyebrow">{solo ? 'TU MOMENTO GUARDADO' : 'ASÍ VIVIMOS NUESTRO MOMENTO'}</div><h2>{solo ? 'Así quieres recordar tu salida.' : 'Dos formas de recordar el mismo día.'}</h2><div className="revealed-grid">{state.participants.map((person) => { const entry = state.memberData[person.id].moment; return <article className="reveal-note" key={person.id}><span><Avatar value={person.avatar} /> {person.name}</span><p>{entry.favorite}</p><small>{(entry.words || []).join(' · ')}</small><Photo item={entry.photo} /></article>; })}</div><button className="secondary-button" onClick={() => { update((before) => ({ ...before, shared: { ...before.shared, memories: [{ id: `moment-${currentUser.id}`, ownerId: currentUser.id, ownerName: currentUser.name, ownerAvatar: currentUser.avatar, type: 'note', text: moment.favorite, shared: true, createdAt: new Date().toISOString() }, ...(before.shared.memories || []).filter((entry) => entry.id !== `moment-${currentUser.id}`)] } })); onToast('Recuerdo guardado en la cápsula.'); }}>Guardar en la cápsula ♡</button></Panel> : <div className="wait-card"><span>✦</span><div><b>{solo ? 'Tu página está guardada.' : 'Tu parte de la historia ya está lista. Falta la otra versión.'}</b><small>{solo ? 'Solo tú puedes verla en esta salida.' : `${partner.name} aún puede completar su página.`}</small></div>{partner && <ParticipantPair first={currentUser} second={partner} />}</div>}</div>
  </div>;
}

function LettersModule({ state, update, updateMember, currentUser, currentMember, onToast }) {
  const [category, setCategory] = useState(categories[0]);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [opened, setOpened] = useState(false);
  const [shareResponse, setShareResponse] = useState(false);
  const history = state.shared?.letterHistory || [];
  const draw = () => {
    const all = letterDeck[category];
    const available = all.filter((text) => !history.includes(`${category}:${text}`));
    const nextPrompt = randomItem(available.length ? available : all);
    if (!available.length) {
      update((previous) => ({ ...previous, shared: { ...previous.shared, letterHistory: previous.shared.letterHistory.filter((key) => !key.startsWith(`${category}:`)) } }));
      setPrompt(nextPrompt);
    } else setPrompt(nextPrompt);
    update((previous) => ({ ...previous, shared: { ...previous.shared, letterHistory: [...new Set([...(previous.shared.letterHistory || []), `${category}:${nextPrompt}`])] } }));
    setResponse(''); setShareResponse(false); setOpened(true);
  };
  const save = () => {
    if (!response.trim()) { onToast('Escribe una respuesta o salta esta pregunta.'); return; }
    const card = { id: newId(), category, prompt, response: response.trim(), shared: shareResponse, createdAt: new Date().toISOString() };
    patchRecord(updateMember, 'letters', (old = []) => [card, ...old]);
    update((previous) => ({ ...previous, shared: { ...previous.shared, letterHistory: [...new Set([...(previous.shared?.letterHistory || []), `${category}:${prompt}`])] } }));
    setOpened(false); setPrompt(''); setResponse(''); setShareResponse(false); onToast(shareResponse ? 'Carta guardada para compartir.' : 'Carta guardada en tu espacio privado.');
  };
  return <div className="module-layout two-column"><Panel className="letter-table"><div className="eyebrow">UNA PREGUNTA PARA SEGUIR CONVERSANDO</div><h2>Elige una categoría y abre el sobre.</h2><div className="category-row">{categories.map((item, index) => <button key={item} className={`category-chip category-${index} ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{['☼','⚡','↔','↺','✦','♡'][index]} {item}</button>)}</div><button className={`digital-envelope ${opened ? 'opened' : ''}`} onClick={draw} aria-label="Abrir una carta">{!opened && <span className="envelope-stamp">✦</span>}<span className="envelope-letter">{opened ? <><small>{category}</small><b>{prompt}</b></> : <><b>Una pregunta<br />para ustedes</b><small>toca para abrir</small></>}</span><span className="envelope-flap" /></button><button className="primary-button" onClick={draw}>{opened ? 'Sacar otra carta ↻' : 'Abrir carta →'}</button><p className="module-hint">No se repiten hasta recorrer todas las cartas de la categoría.</p></Panel>
    <Panel className="answer-panel"><div className="eyebrow">TU RESPUESTA · {currentUser.name.toUpperCase()}</div><h3>{opened ? '¿Qué te inspira esta carta?' : 'La carta te espera.'}</h3><textarea value={response} onChange={(e) => setResponse(e.target.value)} rows="5" placeholder={opened ? 'Escribe lo que te nazca…' : 'Abre un sobre para empezar.'} disabled={!opened} /><ShareToggle checked={shareResponse} onChange={setShareResponse} label="Compartir mi respuesta en la cápsula" /><div className="button-pair"><button className="secondary-button" disabled={!opened} onClick={() => { setOpened(false); setPrompt(''); setResponse(''); }}>Saltar sin penalización</button><button className="primary-button" disabled={!opened} onClick={save}>Guardar carta →</button></div><div className="history-block"><div className="eyebrow">CARTAS EN TU HISTORIAL</div>{(currentMember.letters || []).length ? currentMember.letters.slice(0, 4).map((entry) => <article className="history-entry" key={entry.id}><span>💌 {entry.category}{entry.shared ? ' · Compartida' : ' · Privada'}</span><b>{entry.prompt}</b><small>{entry.response}</small></article>) : <p>Tus cartas respondidas aparecerán aquí.</p>}</div></Panel></div>;
}

const budgetOptions = ['Gratis', 'Económico', 'Intermedio', 'Flexible'];
const planTypes = ['Gastronomía', 'Naturaleza', 'Cultura', 'Entretenimiento', 'Creativo', 'Sorpresa'];
const moods = ['Tranquilo', 'Divertido', 'Romántico', 'Aventurero', 'Espontáneo'];
const times = ['Mañana', 'Tarde', 'Noche'];
function NextAdventure({ state, update, updateMember, currentUser, partner, currentMember, onToast }) {
  const preferences = currentMember.preferences || {};
  const partnerPreferences = state.memberData?.[partner?.id]?.preferences || {};
  const [proposal, setProposal] = useState(state.shared?.selectedPlan || null);
  const setPref = (field, value) => patchRecord(updateMember, 'preferences', (old = {}) => ({ ...old, [field]: value }));
  const propose = () => {
    if (!preferences.budget || !preferences.type || !preferences.mood || !preferences.time) { onToast('Elige presupuesto, panorama, ambiente y momento.'); return; }
    const preferenceSets = [preferences, ...(partnerPreferences.ready ? [partnerPreferences] : [])].filter((entry) => entry.ready || entry === preferences);
    const ranked = planCatalog.map((plan) => ({
      plan,
      score: preferenceSets.reduce((score, entry) => score
        + Number(entry.type === plan.type)
        + Number(entry.mood === plan.mood)
        + Number(entry.budget === plan.budget), 0)
    }));
    const bestScore = Math.max(...ranked.map((entry) => entry.score));
    const matches = bestScore > 0 ? ranked.filter((entry) => entry.score === bestScore).map((entry) => entry.plan) : planCatalog;
    const next = randomItem(matches);
    setProposal(next); setPref('ready', true);
  };
  const savePlan = () => {
    if (!proposal) return;
    update((previous) => ({ ...previous, shared: { ...previous.shared, selectedPlan: proposal, plans: [proposal, ...(previous.shared?.plans || []).filter((plan) => plan.title !== proposal.title)] } }));
    onToast('La próxima aventura ya está guardada.');
  };
  return <div className="module-layout two-column"><Panel className="preference-panel"><div className="eyebrow">{partner ? 'PASO 1 · CADA PERSONA ELIGE' : 'PASO 1 · ELIGE LO QUE TE GUSTA'}</div><h2>{partner ? '¿Qué les tinca para la próxima?' : '¿Qué te tinca para tu próxima salida?'}</h2><ChoiceGroup label="Presupuesto" choices={budgetOptions} value={preferences.budget} onChange={(value) => setPref('budget', value)} /><ChoiceGroup label="Tipo de panorama" choices={planTypes} value={preferences.type} onChange={(value) => setPref('type', value)} /><ChoiceGroup label="Ambiente" choices={moods} value={preferences.mood} onChange={(value) => setPref('mood', value)} /><ChoiceGroup label="¿En qué momento?" choices={times} value={preferences.time} onChange={(value) => setPref('time', value)} /><button className="primary-button full-button" onClick={() => { setPref('ready', true); propose(); }}>Encontrar una aventura →</button>{partner ? <div className="other-preference"><Avatar value={partner.avatar} /> {partnerPreferences.ready ? `${partner.name} ya compartió sus gustos.` : 'Cuando la otra persona elija, verán sus coincidencias.'}</div> : <div className="other-preference">Tu idea se basará en tus preferencias.</div>}</Panel>
    <Panel className="proposal-panel"><div className="eyebrow">{partner ? 'PASO 2 · UNA IDEA PARA USTEDES' : 'PASO 2 · TU PRÓXIMA IDEA'}</div>{proposal ? <><div className="proposal-stamp">✦ NUEVA AVENTURA</div><h2>{proposal.title}</h2><p>{proposal.desc}</p><div className="proposal-tags"><span>{proposal.type}</span><span>{proposal.budget}</span><span>{proposal.duration}</span></div><div className="proposal-detail"><b>Para llevar</b><span>{proposal.kit}</span></div><div className="proposal-detail"><b>Misión especial</b><span>{proposal.mission}</span></div><div className="button-pair"><button className="secondary-button" onClick={propose}>Cambiar propuesta ↻</button><button className="primary-button" onClick={savePlan}>Elegir esta aventura →</button></div>{state.shared?.selectedPlan?.title === proposal.title && <div className="success-note">✓ Guardada como su próxima aventura.</div>}</> : <div className="empty-proposal"><span><img src="/assets/chippa/sello-avion.png" alt="" /></span><h3>Su próxima cita todavía no está escrita.</h3><p>Elige algunas preferencias para descubrir una propuesta.</p></div>}</Panel></div>;
}
function ChoiceGroup({ label, choices, value, onChange }) { return <fieldset className="choice-group"><legend>{label}</legend><div>{choices.map((choice) => <button type="button" key={choice} className={value === choice ? 'chosen' : ''} onClick={() => onChange(choice)}>{choice}</button>)}</div></fieldset>; }

function QuestionGame({ game, state, update, updateMember, currentUser, partner, currentMember, onToast }) {
  const solo = !partner;
  const trivia = game === 'trivia';
  const field = trivia ? 'trivia' : 'same';
  const questions = trivia ? triviaQuestions : sameQuestions;
  const index = state.shared?.game?.[trivia ? 'triviaIndex' : 'sameIndex'] || 0;
  const questionNumber = index % questions.length;
  const complete = Boolean(state.shared?.game?.[`${game}Finished`]);
  const question = questions[questionNumber];
  const answer = currentMember[field]?.[index] || {};
  const otherAnswer = state.memberData?.[partner?.id]?.[field]?.[index];
  const bothAnswered = solo ? Boolean(answer.value) : Boolean(answer.value && answer.share && otherAnswer?.value && otherAnswer?.share);
  const selectedAnswers = (state.participants || []).map((person) => state.memberData?.[person.id]?.[field]?.[index]);
  const exactMatch = !solo && bothAnswered && selectedAnswers[0]?.value === selectedAnswers[1]?.value;
  const setAnswer = (key, value) => patchRecord(updateMember, field, (old = {}) => ({ ...old, [index]: { ...(old[index] || {}), [key]: value } }));
  const advance = () => {
    if (!bothAnswered) { onToast(solo ? 'Elige una respuesta para continuar.' : 'Ambos deben responder y aceptar compartir antes de avanzar.'); return; }
    update((previous) => ({ ...previous, shared: { ...previous.shared, game: { ...previous.shared.game, [trivia ? 'triviaIndex' : 'sameIndex']: questionNumber === questions.length - 1 ? index : index + 1, [`${game}Finished`]: questionNumber === questions.length - 1 } } }));
  };
  if (complete) return <Panel className="round-complete"><span className="round-complete-art">✦</span><div className="eyebrow">RONDA COMPLETA</div><h2>{solo ? 'Una salida, muchas respuestas.' : 'Una cita, muchas formas de recordarla.'}</h2><p>{solo ? 'Completaste las preguntas de esta salida.' : 'Respondieron las preguntas y sus respuestas quedan guardadas en esta experiencia.'}</p><div className="round-answer-list">{questions.map((entry, offset) => { const key = index - questions.length + 1 + offset; return <article key={entry.q}><b>{entry.q}</b>{state.participants.map((person) => <p key={person.id}><span><Avatar value={person.avatar} /> {person.name}</span>{state.memberData?.[person.id]?.[field]?.[key]?.value || '—'}</p>)}</article>; })}</div><button className="primary-button" onClick={() => update((previous) => ({ ...previous, shared: { ...previous.shared, game: { ...previous.shared.game, [trivia ? 'triviaIndex' : 'sameIndex']: index + 1, [`${game}Finished`]: false } } }))}>Comenzar otra ronda ↻</button></Panel>;
  return <div className="module-layout two-column"><Panel className="question-card"><div className="eyebrow">{solo ? 'RESPONDE A TU RITMO' : trivia ? 'RECUERDOS DE ESTE DÍA' : 'MISMA PREGUNTA, DOS VERSIONES'}</div><div className="question-progress"><span>Pregunta {questionNumber + 1} de {questions.length}</span><div><i style={{ width: `${((questionNumber + 1) / questions.length) * 100}%` }} /></div></div><h2>{question.q}</h2><div className="option-list">{question.options.map((option, optionIndex) => <button key={option} className={answer.value === option ? 'selected' : ''} onClick={() => setAnswer('value', option)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}<i>{answer.value === option ? '✓' : ''}</i></button>)}</div><ShareToggle checked={answer.share} onChange={(value) => setAnswer('share', value)} label={solo ? 'Guardar mi respuesta en esta salida' : 'Mi respuesta puede revelarse cuando ambos terminemos'} />{answer.value && answer.share && !bothAnswered && <p className="waiting-inline">Tu parte de la historia ya está lista. Falta la otra versión.</p>}{bothAnswered && <div className={`match-reveal ${exactMatch ? 'match' : ''}`}><span>{exactMatch ? '✦' : '♡'}</span><div><b>{solo ? 'Tu respuesta quedó guardada.' : exactMatch ? '¡Pensaron lo mismo!' : 'Dos perspectivas de una misma historia.'}</b><small>{solo ? 'Solo tú puedes verla en esta salida.' : exactMatch ? 'Una coincidencia para la colección.' : '¡Descubrieron algo nuevo!'}</small></div></div>}{bothAnswered && <div className="answer-reveal-grid">{state.participants.map((person) => <article key={person.id}><span><Avatar value={person.avatar} /> {person.name}</span><b>{state.memberData?.[person.id]?.[field]?.[index]?.value}</b></article>)}</div>}<div className="game-footer"><span><Avatar value={currentUser.avatar} /> {answer.value ? 'Tu respuesta está lista' : 'Tu respuesta sigue privada'}</span><button className="primary-button" onClick={advance} disabled={!bothAnswered}>{questionNumber === questions.length - 1 ? solo ? 'Ver mis respuestas' : 'Ver nuestra ronda' : 'Siguiente pregunta'} →</button></div></Panel>
    <Panel className="game-aside"><div className="eyebrow">SU RECORRIDO</div><h3>Dos miradas, sin puntajes.</h3><p>Las respuestas solo se revelan cuando ambas personas responden y aceptan compartir.</p><div className="player-status">{state.participants?.map((person) => { const response = state.memberData?.[person.id]?.[field]?.[index]; return <div key={person.id}><span className="avatar-sm"><Avatar value={person.avatar} /></span><span><b>{person.name}</b><small>{response?.value && response?.share ? 'Respuesta lista' : 'Pensando…'}</small></span><i>{response?.value && response?.share ? '✓' : '···'}</i></div>; })}</div>{state.mode === 'demo' && import.meta.env.DEV && partner && <button className="secondary-button full-button" onClick={() => update((previous) => ({ ...previous, activeUserId: partner.id }))}>Responder como {partner.name} ⇄</button>}<div className="neutral-note">♥ Estas actividades celebran lo que vivieron, no miden compatibilidad.</div></Panel></div>;
}

const missionList = [
  { id: 'first-memory', title: 'Guarden un momento favorito', desc: 'Completen Nuestro momento y decidan compartirlo.', icon: '📓', check: (state) => state.participants?.every((person) => state.memberData?.[person.id]?.moment?.ready && state.memberData?.[person.id]?.moment?.share) },
  { id: 'three-cards', title: 'Tres cartas después de la cita', desc: 'Respondan tres cartas y guarden alguna para releer.', icon: '💌', check: (state) => Object.values(state.memberData || {}).reduce((sum, member) => sum + (member.letters?.length || 0), 0) >= 3 },
  { id: 'memory-pairs', title: 'Cada recuerdo con su pareja', desc: 'Completen una partida de Match de recuerdos.', icon: '🃏', check: (state) => (state.shared?.game?.matchedPairs || 0) >= 4 },
  { id: 'trivia-round', title: 'Dos miradas de la misma cita', desc: 'Terminen una ronda de Trivia post-cita.', icon: '🎯', check: (state) => Boolean(state.shared?.game?.triviaFinished) || (state.shared?.game?.triviaIndex || 0) >= triviaQuestions.length }
];
function MissionsModule({ state, update, currentUser, onNavigate }) {
  const completed = state.shared?.missions || [];
  const list = missionList.map((item, index) => ({ ...item, target: ['moment', 'letters', 'memory', 'trivia'][index], ready: item.check(state), done: completed.includes(item.id) }));
  const totalDone = list.filter((item) => item.done).length;
  const finish = (item) => update((previous) => ({ ...previous, shared: { ...previous.shared, missions: [...new Set([...(previous.shared?.missions || []), item.id])], stamps: [...new Set([...(previous.shared?.stamps || []), `Misión: ${item.title}`])] } }));
  return <div className="mission-page"><Panel className="mission-banner"><div><div className="eyebrow">MISIONES CHIPPA</div><h2>Un pequeño desafío desbloquea otra aventura.</h2><p>Las misiones se completan con actividades que ya hacen juntos.</p><div className="mission-progress"><span style={{ width: `${(totalDone / list.length) * 100}%` }} /></div><small>{totalDone} de {list.length} misiones guardadas</small></div><div className="mission-star">✦<span>🏅</span></div></Panel><div className="mission-grid">{list.map((mission, index) => <Panel className={`mission-card ${mission.done ? 'done' : ''}`} key={mission.id}><div className="mission-top"><span className={`mission-icon mission-${index}`}>{mission.done ? '✓' : mission.icon}</span><span className={`status-tag ${mission.ready || mission.done ? 'ready' : ''}`}>{mission.done ? 'Completada' : mission.ready ? 'Desbloqueada' : 'En progreso'}</span></div><h3>{mission.title}</h3><p>{mission.desc}</p>{mission.done ? <div className="success-note">✦ Estampilla agregada a su pasaporte.</div> : <button className="secondary-button" onClick={() => mission.ready ? finish(mission) : onNavigate?.(mission.target)}>{mission.ready ? 'Reclamar misión →' : 'Ir a la actividad →'}</button>}</Panel>)}</div></div>;
}

function QuestionBankModule({ state, updateMember, currentUser, currentMember, onToast }) {
  const cats = Object.keys(questionBank);
  const [category, setCategory] = useState(cats[0]);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [favorite, setFavorite] = useState(false);
  const draw = () => { const used = (currentMember.questions || []).map((entry) => entry.prompt); const choices = questionBank[category].filter((item) => !used.includes(item)); setPrompt(randomItem(choices.length ? choices : questionBank[category])); setAnswer(''); setFavorite(false); };
  const save = () => {
    if (!prompt) { onToast('Revela una pregunta primero.'); return; }
    if (!answer.trim()) { onToast('Escribe una respuesta breve.'); return; }
    patchRecord(updateMember, 'questions', (old = []) => [{ id: newId(), category, prompt, answer: answer.trim(), favorite, shared: favorite, createdAt: new Date().toISOString() }, ...old]);
    onToast(favorite ? 'Pregunta guardada como favorita para compartir.' : 'Tu respuesta quedó guardada.'); setPrompt(''); setAnswer('');
  };
  return <div className="module-layout two-column"><Panel className="question-bank-panel"><div className="eyebrow">UN BANCO DE PREGUNTAS PARA DOS</div><h2>Una pregunta nueva siempre abre una puerta.</h2><ChoiceGroup label="Elige un tema" choices={cats} value={category} onChange={(value) => { setCategory(value); setPrompt(''); }} />{prompt ? <div className="bank-prompt"><span>✦ {category}</span><b>{prompt}</b></div> : <div className="empty-proposal"><span>🗂️</span><p>Elige un tema y deja que Chippa saque una tarjeta.</p></div>}<button className="secondary-button" onClick={draw}>Revelar pregunta al azar ↻</button></Panel><Panel className="bank-answer"><div className="eyebrow">TU RESPUESTA · {currentUser.name.toUpperCase()}</div><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Escribe una idea que quieras compartir…" rows="5" /><ShareToggle checked={favorite} onChange={setFavorite} label="Guardar como favorita para compartir" /><button className="primary-button full-button" onClick={save} disabled={!prompt}>Guardar respuesta →</button><div className="history-block"><div className="eyebrow">TUS PREGUNTAS GUARDADAS</div>{(currentMember.questions || []).slice(0, 5).map((entry) => <article className="history-entry" key={entry.id}><span>{entry.category} · {entry.favorite ? '♡ Favorita' : 'Privada'}</span><b>{entry.prompt}</b><small>{entry.answer}</small></article>)}{!currentMember.questions?.length && <p>Tus respuestas aparecerán aquí.</p>}</div></Panel></div>;
}

function PassportModule({ state, currentUser, partner, completeActivity }) {
  const experiencePlaces = [state.experience?.place, ...(state.experienceOptions || []).map((entry) => entry.place), ...(state.experienceArchives || []).map((entry) => entry.experience.place)].filter(Boolean);
  const missionStamps = (state.shared?.stamps || []).filter((stamp) => stamp.startsWith('Misión:'));
  const places = [...new Set([...experiencePlaces, ...(state.shared?.stamps || []).filter((stamp) => !stamp.startsWith('Misión:'))])];
  const history = state.mode === 'demo' ? (state.experienceArchives || []).map((entry) => entry.experience) : (state.experienceOptions || []).filter((entry) => entry.id !== state.experience?.id);
  return <div className="passport-layout"><figure className="passport-cover">
    <div className="passport-art"><img src="/assets/chippa/pasaporte.png" alt="Portada del pasaporte Chippa" /></div>
    <figcaption>{currentUser.name}</figcaption>
  </figure><div className="passport-details"><Panel><div className="eyebrow">SU COLECCIÓN</div><h2>Un nuevo lugar para recordar.</h2><div className="passport-stats"><div><b>{places.length}</b><small>lugares</small></div><div><b>{Math.max(1, experiencePlaces.length)}</b><small>experiencias</small></div><div><b>{missionStamps.length}</b><small>misiones</small></div></div><button className="secondary-button full-button" disabled={!state.experience?.place || !state.experience?.date} onClick={completeActivity}>Sellar esta visita con CHIPPA</button><div className="passport-note">Las estampillas registran experiencias anotadas por ustedes. No verifican la visita presencial.</div></Panel><Panel><div className="eyebrow">ESTAMPILLAS DIGITALES</div><div className="stamp-grid">{places.map((stamp, index) => <div className={`stamp stamp-${index % 5}`} key={stamp}><span>{['📍','🌳','🌸','🛍️','🌆'][index % 5]}</span><b>{stamp}</b><small>REGISTRADO</small></div>)}{missionStamps.map((stamp, index) => <div className={`stamp stamp-${(index + 2) % 5}`} key={stamp}><span>⭐</span><b>{stamp.replace('Misión: ', '')}</b><small>MISIÓN</small></div>)}{!places.length && !missionStamps.length && <p>Aún no hay estampillas. Registren una experiencia para obtener la primera.</p>}</div></Panel><Panel><div className="eyebrow">ESTE CAPÍTULO</div><div className="passport-entry"><span><img className="passport-chapter-camera" src="/assets/chippa/camera-icon.png" alt="" /></span><div><b>{state.experience?.title}</b><small>{state.experience?.place} · {labelDate(state.experience?.date)}</small></div><span><Avatar value={currentUser.avatar} /> + <Avatar value={partner?.avatar} /></span></div>{history.length > 0 && <div className="history-block"><div className="eyebrow">OTRAS EXPERIENCIAS</div>{history.map((entry) => <div className="passport-entry history-passport-entry" key={entry.id}><span>{experienceMark(entry.emoji)}</span><div><b>{entry.title}</b><small>{entry.place} · {labelDate(entry.date)}</small></div></div>)}</div>}</Panel></div></div>;
}

function CapsuleModule({ state, update, currentUser, currentMember, partner, onToast }) {
  const { persistCurrent } = useAppState();
  const [text, setText] = useState('');
  const [shared, setShared] = useState(true);
  const [photo, setPhoto] = useState(null);
  const [layout, setLayout] = useState('scrapbook');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);
  const sharedMemories = state.shared?.memories || [];
  const ownPrivate = (currentMember.memories || []).filter((item) => !item.shared);
  const memoryCount = sharedMemories.length + ownPrivate.length;

  useEffect(() => {
    if (!photo?.data || !photo.file) return undefined;
    return () => URL.revokeObjectURL(photo.data);
  }, [photo]);

  const updateMemories = (isPrivate, updater) => {
    let applied = false;
    update((previous) => {
      if (previous?.experience?.id !== state.experience.id || previous.activeUserId !== state.activeUserId) return previous;
      applied = true;
      if (!isPrivate) {
        return { ...previous, shared: { ...previous.shared, memories: updater(previous.shared?.memories || []) } };
      }
      const member = previous.memberData?.[currentUser.id] || {};
      return {
        ...previous,
        memberData: {
          ...previous.memberData,
          [currentUser.id]: { ...member, memories: updater(member.memories || []) }
        }
      };
    });
    return applied;
  };

  const add = async () => {
    if (saving || (!text.trim() && !photo)) return;
    setSaving(true);
    try {
      let photoData = photo;
      if (photo?.file) {
        if (state.mode === 'cloud') photoData = await uploadExperiencePhoto(photo.file, state.experience.id, currentUser.id);
        else if (photo.file.size <= 1200000) photoData = { data: await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(photo.file); }) };
        else throw new Error('La foto debe pesar menos de 1,2 MB.');
      }
      if (state.mode === 'cloud' && shared && photoData?.path) await setExperiencePhotoShared(photoData.path, true);
      const memory = { id: newId(), ownerId: currentUser.id, ownerName: currentUser.name, ownerAvatar: currentUser.avatar, type: photoData ? 'photo' : 'note', text: text.trim(), photo: photoData, shared, createdAt: new Date().toISOString() };
      const applied = updateMemories(!shared, (memories) => [memory, ...memories]);
      if (!applied) throw new Error('La salida cambió antes de guardar el recuerdo. Vuelve a abrirla para intentarlo.');
      const persisted = state.mode !== 'cloud' || await persistCurrent();
      setText('');
      setPhoto(null);
      if (fileInput.current) fileInput.current.value = '';
      if (persisted) onToast(shared ? 'Recuerdo agregado a la cápsula.' : 'Recuerdo guardado en tu espacio privado.');
    } catch (error) { onToast(error.message || 'No pudimos agregar el recuerdo.'); }
    finally { setSaving(false); }
  };
  const remove = async (memory, isPrivate) => {
    if (memory.ownerId !== currentUser.id) { onToast('Solo quien agregó un recuerdo puede eliminarlo.'); return; }
    if (!window.confirm('¿Eliminar este recuerdo? Esta acción no se puede deshacer.')) return;
    const applied = updateMemories(isPrivate, (memories) => memories.filter((entry) => entry.id !== memory.id));
    if (!applied || (state.mode === 'cloud' && !await persistCurrent())) return;
    if (state.mode === 'cloud' && memory.photo?.path) setExperiencePhotoShared(memory.photo.path, false).catch(() => {});
    onToast('Recuerdo eliminado.');
  };
  const download = (memory) => { const content = JSON.stringify({ title: 'Recuerdo Chippa', text: memory.text, createdAt: memory.createdAt }, null, 2); const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'recuerdo-chippa.json'; anchor.click(); URL.revokeObjectURL(url); };
  const renderMemory = (memory, isPrivate) => (
    <article key={memory.id} className={`capsule-memory ${layout === 'polaroids' ? 'polaroid-memory' : ''}`}>
      <Photo item={memory.photo} alt={memory.ownerName ? `Foto de ${memory.ownerName}` : 'Foto del recuerdo'} />
      {memory.text && <p>{memory.text}</p>}
      <div className="memory-byline">
        <span><Avatar value={memory.ownerAvatar} /> {memory.ownerName}</span>
        <time dateTime={memory.createdAt}>{new Date(memory.createdAt).toLocaleDateString('es-CL')}</time>
      </div>
      <div className="memory-actions">
        {isPrivate && <i>🔒 Privado</i>}
        {memory.ownerId === currentUser.id && <>
          <button type="button" onClick={() => download(memory)}>↓ Descargar</button>
          <button type="button" onClick={() => remove(memory, isPrivate)}>Eliminar</button>
        </>}
      </div>
    </article>
  );

  return <div className="capsule-page">
    <Panel className="capsule-intro">
      <div>
        <div className="eyebrow">{state.experience.title}</div>
        <h2>{partner ? 'Álbum compartido' : 'Tu álbum de la salida'}</h2>
        <p>{partner ? `Tú y ${partner.name} pueden agregar fotos y notas. Cada persona elige cuáles compartir.` : 'Guarda fotos y notas de esta salida.'}</p>
      </div>
      <div className="capsule-doodle"><img src="/assets/chippa/marco-polaroid-vintage.png" alt="" /><span aria-hidden="true">♡</span></div>
    </Panel>
    <Panel className="capsule-composer">
      <form onSubmit={(event) => { event.preventDefault(); add(); }}>
        <label className="eyebrow" htmlFor="capsule-text">AGREGAR UN RECUERDO</label>
        <textarea id="capsule-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escribe una nota o agrega una foto…" rows="3" />
        <div className="composer-bottom">
          <label className="file-pick compact-file">＋ Foto
            <input ref={fileInput} type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0];
              setPhoto(file ? { file, data: URL.createObjectURL(file) } : null);
            }} />
            <small>opcional</small>
          </label>
          {photo && <img className="composer-preview" src={photo.data} alt="Vista previa" />}
          <ShareToggle checked={shared} onChange={setShared} label={partner ? `Compartir con ${partner.name}` : 'Incluir en mi cápsula'} />
          <button className="primary-button" disabled={saving || (!text.trim() && !photo)}>{saving ? 'Guardando…' : 'Guardar en la cápsula →'}</button>
        </div>
      </form>
    </Panel>
    <div className="capsule-toolbar">
      <h3>{memoryCount} {memoryCount === 1 ? 'recuerdo' : 'recuerdos'}</h3>
      <div className="layout-switch" role="group" aria-label="Formato de la galería">
        <button type="button" className={layout === 'scrapbook' ? 'active' : ''} aria-pressed={layout === 'scrapbook'} onClick={() => setLayout('scrapbook')}>Scrapbook</button>
        <button type="button" className={layout === 'polaroids' ? 'active' : ''} aria-pressed={layout === 'polaroids'} onClick={() => setLayout('polaroids')}>Polaroids</button>
      </div>
    </div>
    {memoryCount ? <div className="capsule-grid">
      {sharedMemories.map((item) => renderMemory(item, false))}
      {ownPrivate.map((item) => renderMemory(item, true))}
    </div> : <div className="empty-proposal"><span aria-hidden="true">📸</span><h3>La cápsula todavía está vacía.</h3><p>Agrega una foto o una nota para empezar.</p></div>}
  </div>;
}

function FutureLetters({ state, updateMember, completeActivity, currentUser, currentMember, onToast }) {
  const [form, setForm] = useState({ title: '', message: '', openAt: '', recipientId: '' });
  const [openId, setOpenId] = useState(null);
  const [cloudLetters, setCloudLetters] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (state.mode !== 'cloud') return undefined;
    let active = true;
    loadCloudFutureLetters(state.experience.id).then((rows) => {
      if (active) setCloudLetters(rows.map((row) => ({ id: row.id, title: row.title, message: row.body, openAt: row.open_at, recipientId: row.recipient_id, senderId: row.sender_id, createdAt: row.created_at })));
    }).catch((error) => onToast(error.message || 'No pudimos cargar las cartas del futuro.'));
    return () => { active = false; };
  }, [state.mode, state.experience?.id, onToast]);
  const save = async () => {
    if (!form.title.trim() || !form.message.trim() || !form.openAt) { onToast('Completa el título, mensaje y fecha de apertura.'); return; }
    if (new Date(`${form.openAt}T00:00:00`) < new Date(new Date().toDateString())) { onToast('Elige una fecha de hoy o posterior.'); return; }
    const letter = { id: newId(), ...form, recipientId: form.recipientId || currentUser.id, senderId: currentUser.id, opened: false, shared: true, createdAt: new Date().toISOString() };
    setSaving(true);
    try {
      if (state.mode === 'cloud') {
        const row = await createCloudFutureLetter({ experienceId: state.experience.id, senderId: currentUser.id, recipientId: letter.recipientId, title: letter.title.trim(), body: letter.message.trim(), openAt: letter.openAt });
        setCloudLetters((previous) => [{ ...letter, id: row.id, createdAt: row.created_at }, ...previous]);
      } else patchRecord(updateMember, 'future', (old = []) => [letter, ...old]);
      completeActivity(); setForm({ title: '', message: '', openAt: '', recipientId: '' }); onToast('Carta guardada en su sobre del futuro.');
    } catch (error) { onToast(error.message || 'No pudimos sellar la carta.'); }
    finally { setSaving(false); }
  };
  const open = (letter) => {
    if (letter.senderId !== currentUser.id && new Date(`${letter.openAt}T00:00:00`) > new Date()) { onToast(`Esta carta se abre el ${new Date(`${letter.openAt}T12:00:00`).toLocaleDateString('es-CL')}.`); return; }
    setOpenId(openId === letter.id ? null : letter.id);
  };
  const letters = state.mode === 'cloud' ? cloudLetters : [
    ...(currentMember.future || []),
    ...Object.entries(state.memberData || {}).filter(([memberId]) => memberId !== currentUser.id)
      .flatMap(([, member]) => (member.future || []).filter((letter) => letter.recipientId === currentUser.id))
  ];
  return <div className="module-layout two-column"><Panel className="future-form"><div className="eyebrow">ESCRIBE HOY, RECUERDA DESPUÉS</div><h2>Una carta para abrir en otro momento.</h2><label>Título de la carta<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Algo que quiero recordar" /></label><label>Destinatario<select value={form.recipientId} onChange={(e) => setForm({ ...form, recipientId: e.target.value })}><option value="">Para mí</option>{state.participants.filter((person) => person.id !== currentUser.id).map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label><label>Mensaje<textarea rows="5" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Un mensaje para nuestro yo del futuro…" /></label><label>Fecha de apertura<input type="date" value={form.openAt} onChange={(e) => setForm({ ...form, openAt: e.target.value })} min={localDateValue()} /></label><button className="primary-button full-button" onClick={save} disabled={saving}>{saving ? 'Sellando…' : 'Sellar carta del futuro ✦'}</button><div className="storage-note">{state.mode === 'demo' ? 'La fecha de apertura se controla en este dispositivo.' : 'El contenido se mantiene oculto para el destinatario hasta la fecha de apertura.'}</div></Panel><Panel className="future-list"><div className="eyebrow">SOBRES PARA TI O TU ACOMPAÑANTE</div><h3>El tiempo también es parte de la historia.</h3>{letters.map((letter) => { const due = new Date(`${letter.openAt}T00:00:00`) <= new Date(); const recipient = state.participants.find((person) => person.id === letter.recipientId); return <article key={letter.id} className={`future-envelope ${due ? 'due' : ''}`}><div className="future-seal">{due ? '✦' : '🔒'}</div><div><small>PARA {recipient?.name?.toUpperCase() || currentUser.name.toUpperCase()} · {new Date(`${letter.openAt}T12:00:00`).toLocaleDateString('es-CL')}</small><b>{letter.title}</b>{openId === letter.id && <p>{letter.message}</p>}</div><button className="secondary-button" onClick={() => open(letter)}>{openId === letter.id ? 'Cerrar' : due || letter.senderId === currentUser.id ? 'Abrir carta' : 'Ver fecha'}</button></article>; })}{!letters.length && <div className="empty-proposal"><span>📨</span><p>Aún no hay sobres esperando su momento.</p></div>}</Panel></div>;
}

function PlaylistModule({ state, update, updateMember, currentUser, onToast }) {
  const [form, setForm] = useState({ title: '', artist: '', link: '', comment: '' });
  const [track, setTrack] = useState(0);
  const songs = state.shared?.songs || [];
  const selectedTrack = songs.length ? ((track % songs.length) + songs.length) % songs.length : 0;
  const currentSong = songs[selectedTrack];
  const add = () => {
    if (!form.title.trim() || !form.artist.trim()) { onToast('Agrega el nombre de la canción y su artista.'); return; }
    if (form.link && !/^https:\/\//i.test(form.link)) { onToast('El enlace debe comenzar con https://'); return; }
    const song = { id: newId(), ...form, title: form.title.trim(), artist: form.artist.trim(), addedBy: currentUser.name, ownerId: currentUser.id, avatar: currentUser.avatar, createdAt: new Date().toISOString() };
    update((previous) => ({ ...previous, shared: { ...previous.shared, songs: [song, ...(previous.shared?.songs || [])] } }));
    setForm({ title: '', artist: '', link: '', comment: '' }); onToast('Canción agregada a la banda sonora.');
  };
  const remove = (song) => { if (song.ownerId !== currentUser.id) { onToast('Solo quien agregó esta canción puede quitarla.'); return; } update((previous) => ({ ...previous, shared: { ...previous.shared, songs: previous.shared.songs.filter((item) => item.id !== song.id) } })); };
  return <div className="module-layout two-column"><Panel className="playlist-player"><div className="eyebrow">BANDA SONORA DEL CAPÍTULO</div><div className="retro-player"><div className="player-screen"><span>CHIPPA FM</span><div>♪</div><small>{currentSong ? `${currentSong.title} - ${currentSong.artist}` : 'Agrega tu primera canción'}</small></div><div className="player-controls"><button disabled={!songs.length} aria-label="Canción anterior" onClick={() => setTrack(selectedTrack - 1)}>◀</button><button className="play-button" aria-label="Abrir canción seleccionada" disabled={!currentSong?.link} onClick={() => window.open(currentSong.link, '_blank', 'noopener,noreferrer')}>▶</button><button disabled={!songs.length} aria-label="Siguiente canción" onClick={() => setTrack(selectedTrack + 1)}>▶|</button></div><div className="player-status-bar"><span>{state.shared?.songs?.length || 0} TRACKS</span><span>NO MUSIC FILES STORED</span></div></div><p>Una colección de enlaces y dedicatorias. Chippa no reproduce ni descarga música.</p></Panel><Panel className="song-form"><div className="eyebrow">AGREGA UNA CANCIÓN</div><label>Nombre de la canción<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Canción" /></label><label>Artista<input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} placeholder="Artista" /></label><label>Enlace musical opcional<input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://open.spotify.com/…" /></label><label>¿Por qué la elegiste?<textarea rows="2" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Me recuerda a…" /></label><button className="primary-button full-button" onClick={add}>Agregar a la playlist →</button></Panel><div className="wide-result"><div className="playlist-heading"><div><div className="eyebrow">CANCIONES AGREGADAS</div><h2>La música de su cita.</h2></div><span>♡ {state.shared?.songs?.length || 0}</span></div><div className="song-list">{(state.shared?.songs || []).map((song, index) => <article key={song.id} className="song-row"><span className={`song-number song-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span><div className="song-disc">♪</div><div className="song-info"><b>{song.title}</b><small>{song.artist} · <Avatar value={song.avatar} /> {song.addedBy}</small>{song.comment && <p>“{song.comment}”</p>}</div>{song.link && <a href={song.link} target="_blank" rel="noreferrer" className="open-song">Abrir ↗</a>}{song.ownerId === currentUser.id && <button className="icon-button" onClick={() => remove(song)} aria-label="Eliminar canción">×</button>}</article>)}{!state.shared?.songs?.length && <div className="empty-proposal"><span>🎧</span><p>La primera canción puede ser la que les recuerde este momento.</p></div>}</div></div></div>;
}

function PlanGenerator({ state, update, updateMember, currentUser, partner, currentMember, onToast }) {
  const [form, setForm] = useState({ budget: 'Económico', type: 'Sorpresa', mood: 'Divertido', duration: 'Media', setting: 'Cualquiera' });
  const [plan, setPlan] = useState(state.shared?.generatedPlan || null);
  const votes = currentMember.votes || {};
  const results = useMemo(() => planCatalog.filter((item) => {
    const budgetOkay = form.budget === 'Flexible' || item.budget === form.budget || item.budget === 'Económico' && form.budget === 'Intermedio' || form.budget === 'Económico' && item.budget === 'Gratis';
    const typeOkay = form.type === 'Sorpresa' || item.type === form.type;
    const moodOkay = form.mood === 'Sorpresa' || item.mood === form.mood;
    const settingOkay = form.setting === 'Cualquiera' || item.setting === form.setting || item.setting === 'Cualquiera';
    const durationOkay = form.duration === 'Cualquiera' || item.duration === form.duration;
    return budgetOkay && typeOkay && moodOkay && settingOkay && durationOkay;
  }), [form]);
  const generate = () => { const next = randomItem(results.length ? results : planCatalog); setPlan(next); update((before) => ({ ...before, shared: { ...before.shared, generatedPlan: next } })); };
  const save = () => { if (!plan) return; update((previous) => ({ ...previous, shared: { ...previous.shared, plans: [plan, ...(previous.shared?.plans || []).filter((item) => item.title !== plan.title)] } })); onToast('Plan agregado a su próxima aventura.'); };
  const vote = (value) => { patchRecord(updateMember, 'votes', (old = {}) => ({ ...old, [plan?.title]: value })); };
  return <div className="module-layout two-column"><Panel className="plan-form"><div className="eyebrow">UNA PROPUESTA A SU MEDIDA</div><h2>¿Qué tipo de salida les gustaría?</h2><label>Presupuesto<select value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })}>{['Gratis','Económico','Intermedio','Flexible'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Tipo de panorama<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{['Sorpresa','Gastronomía','Naturaleza','Cultura','Entretenimiento','Creativo'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Ambiente<select value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })}>{['Sorpresa','Tranquilo','Divertido','Romántico','Aventurero','Espontáneo'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Duración<select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>{['Cualquiera','Corta','Media','Larga'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Interior o exterior<select value={form.setting} onChange={(e) => setForm({ ...form, setting: e.target.value })}>{['Cualquiera','Interior','Exterior'].map((item) => <option key={item}>{item}</option>)}</select></label><button className="primary-button full-button" onClick={generate}>Generar un plan ✦</button><small className="orientative-note">El presupuesto es orientativo. No representa precios actuales.</small></Panel><Panel className="generated-plan"><div className="eyebrow">SU PRÓXIMA IDEA</div>{plan ? <><span className="generated-stamp">CHIPPA PLAN · {plan.type.toUpperCase()}</span><h2>{plan.title}</h2><p>{plan.desc}</p><div className="plan-info"><div><small>PREPARA</small><b>{plan.kit}</b></div><div><small>MISIÓN ESPECIAL</small><b>{plan.mission}</b></div></div><div className="plan-tags"><span>{plan.budget} · orientativo</span><span>{plan.setting}</span><span>{plan.duration}</span></div><div className="vote-row"><span>¿Te tinca este plan?</span><button className={votes[plan.title] === 'yes' ? 'chosen' : ''} onClick={() => vote('yes')}>♡ Sí</button><button className={votes[plan.title] === 'later' ? 'chosen' : ''} onClick={() => vote('later')}>◷ Después</button>{partner && <small>{state.memberData?.[partner.id]?.votes?.[plan.title] ? 'Tu acompañante también votó.' : 'Falta el voto de tu acompañante.'}</small>}</div><div className="button-pair"><button className="secondary-button" onClick={generate}>Generar otro ↻</button><button className="primary-button" onClick={save}>Guardar este plan →</button></div></> : <div className="empty-proposal"><span>🎲</span><h3>Una propuesta nueva les espera.</h3><p>Elige tus preferencias y deja que aparezca una idea posible.</p></div>}{!results.length && <small className="orientative-note">No encontramos una coincidencia exacta; mostraremos una idea cercana.</small>}</Panel></div>;
}
