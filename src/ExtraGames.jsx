import { useState } from 'react';
import { destinations } from './data.js';
import CompletionStamp from './CompletionStamp.jsx';

const bingoItems = ['Nos reímos juntos', 'Descubrimos un rincón', 'Compartimos una canción', 'Probamos algo rico', 'Contamos una anécdota', 'Hicimos una foto', 'Perdimos la noción del tiempo', 'Aprendimos algo del otro', 'Imaginamos otra cita'];
export const bingoWon = (selected = []) => [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some((line) => line.every((index) => selected.includes(index)));

export function BingoGame({ currentMember, updateMember }) {
  const data = currentMember.bingo || { selected: [], completed: false };
  const toggle = (index) => updateMember((member) => {
    const previous = member.bingo || { selected: [], completed: false };
    const selected = previous.selected.includes(index) ? previous.selected.filter((value) => value !== index) : [...previous.selected, index];
    return { ...member, bingo: { selected, completed: previous.completed || bingoWon(selected) } };
  });
  return <section className="module-panel extra-game"><div className="eyebrow">PEQUEÑOS MOMENTOS, UNA GRAN HISTORIA</div><h2>Bingo de recuerdos</h2><p>Marquen lo que vivieron en la cita. Completen una fila, columna o diagonal para conseguir su timbre.</p><div className="bingo-board">{bingoItems.map((text, index) => <button key={text} aria-pressed={data.selected.includes(index)} className={data.selected.includes(index) ? 'chosen' : ''} onClick={() => toggle(index)}><span>{data.selected.includes(index) ? '✓' : '♡'}</span>{text}</button>)}</div>{data.completed && <div className="game-finish"><CompletionStamp /><h3>¡Bingo! Un recuerdo más en su colección.</h3></div>}<button className="secondary-button" onClick={() => updateMember((member) => ({ ...member, bingo: { selected: [], completed: false } }))}>Nuevo tablero ↻</button></section>;
}

const quiz = [
  ['¿Qué panorama elegiría tu acompañante?', ['Un café', 'Un paseo', 'Una película', 'Algo inesperado']],
  ['¿Qué detalle le alegraría el día?', ['Una canción', 'Una nota', 'Algo rico', 'Una sorpresa']],
  ['¿Cómo prefiere pasar una tarde libre?', ['Conversando', 'Explorando', 'Descansando', 'Creando algo']],
  ['¿Qué recuerdo de una cita guardaría primero?', ['Una foto', 'Una frase', 'Un lugar', 'Una canción']]
];
export function CoupleQuiz({ currentMember, updateMember, partner }) {
  const data = currentMember.coupleQuiz || { index: 0, answers: [], completed: false };
  const [choice, setChoice] = useState('');
  const advance = () => { if (!choice) return; updateMember((member) => { const before = member.coupleQuiz || { index: 0, answers: [] }; return { ...member, coupleQuiz: { index: before.index + 1, answers: [...before.answers, choice], completed: before.index + 1 === quiz.length } }; }); setChoice(''); };
  return <section className="module-panel extra-game"><div className="eyebrow">CONOCERSE ES SEGUIR DESCUBRIENDO</div><h2>¿Quién conoce más?</h2>{data.completed ? <><div className="game-finish"><CompletionStamp /><h3>Ya tienes tus predicciones.</h3><p>Conversen con {partner?.name || 'tu acompañante'} para descubrir en qué coincidieron.</p></div><div className="round-answer-list">{quiz.map(([question], index) => <article key={question}><b>{question}</b><p>{data.answers[index]}</p></article>)}</div><button className="primary-button" onClick={() => updateMember((member) => ({ ...member, coupleQuiz: { index: 0, answers: [], completed: false } }))}>Otra ronda ↻</button></> : <><div className="question-progress"><span>Pregunta {data.index + 1} de {quiz.length}</span></div><h3>{quiz[data.index][0]}</h3><p>Elige lo que crees que respondería tu acompañante.</p><div className="option-list">{quiz[data.index][1].map((option) => <button key={option} className={choice === option ? 'selected' : ''} aria-pressed={choice === option} onClick={() => setChoice(option)}>{option}</button>)}</div><button className="primary-button" disabled={!choice} onClick={advance}>{data.index === quiz.length - 1 ? 'Terminar ronda' : 'Guardar y continuar'} →</button></>}</section>;
}

const places = [
  { name: 'Barrio Lastarria', clues: ['Sus calles reúnen arte, cafés y fachadas con historia.', 'Muy cerca se encuentra el cerro Santa Lucía.', 'Su nombre comienza con L.'] },
  { name: 'Parque Araucano', clues: ['Es una pausa verde en medio de la ciudad.', 'Se encuentra en Las Condes.', 'Su nombre comienza con A.'] },
  { name: 'Jardín Japonés', clues: ['Es un lugar para pasear con calma.', 'Su diseño se inspira en un país de Asia.', 'Su nombre empieza con Jardín.'] }
];
export function PlaceGame({ currentMember, updateMember }) {
  const data = currentMember.placeGame || { index: 0, hint: 0, attempts: 0, completed: false };
  const [feedback, setFeedback] = useState('');
  const place = places[data.index % places.length];
  const answer = (name) => {
    const correct = name === place.name;
    updateMember((member) => { const before = member.placeGame || { index: 0, hint: 0, attempts: 0 }; return { ...member, placeGame: { ...before, attempts: before.attempts + 1, hint: correct ? 0 : Math.min(2, before.hint + 1), index: correct ? before.index + 1 : before.index, completed: correct && before.index + 1 >= places.length } }; });
    setFeedback(correct ? '¡Lugar descubierto! Vamos con el siguiente.' : 'Todavía no. Prueba otra opción; tienes una pista más.');
  };
  return <section className="module-panel extra-game"><div className="eyebrow">SIGAN LAS PISTAS</div><h2>Adivina el lugar</h2>{data.completed ? <><div className="game-finish"><CompletionStamp /><h3>¡Encontraste todos los destinos!</h3><p>{data.attempts} intentos para descubrir {places.length} lugares.</p></div><button className="primary-button" onClick={() => { setFeedback(''); updateMember((member) => ({ ...member, placeGame: { index: 0, hint: 0, attempts: 0, completed: false } })); }}>Explorar otra vez ↻</button></> : <><p>Destino {data.index + 1} de {places.length}. Elige el lugar que describen las pistas.</p><div className="place-clues">{place.clues.slice(0, data.hint + 1).map((clue, index) => <p key={clue}><b>Pista {index + 1}</b>{clue}</p>)}</div><button className="secondary-button" disabled={data.hint >= 2} onClick={() => updateMember((member) => ({ ...member, placeGame: { ...data, hint: data.hint + 1 } }))}>Ver otra pista</button><div className="option-list">{destinations.filter((name) => name !== 'Otro lugar').map((name) => <button key={name} onClick={() => answer(name)}>{name}</button>)}</div><p role="status">{feedback}</p></>}</section>;
}
