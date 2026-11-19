import { useEffect, useId, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { destinations } from './data.js';
import { labelDate, localDateValue } from './lib/format.js';

const marks = [
  { label: 'Chisposita', file: 'chisposita-circulo.png' },
  { label: 'Parque', file: 'mark-parque.svg' },
  { label: 'Café', file: 'mark-cafe.svg' },
  { label: 'Cine', file: 'mark-cine.svg' },
  { label: 'Montaña', file: 'mark-montana.svg' },
  { label: 'Pícnic', file: 'mark-picnic.svg' },
  { label: 'Fotos', file: 'mark-fotos.svg' }
].map((mark) => ({ ...mark, src: `/assets/chippa/${mark.file}` }));

const week = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const monthLabel = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function monthOf(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(1);
  return date;
}

function OutingDateField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthOf(value));
  const [focusDay, setFocusDay] = useState(() => Number(value.slice(8)));
  const calendarId = useId();
  const calendar = useRef(null);
  const trigger = useRef(null);
  const monthName = monthLabel.format(month);
  const blanks = (month.getUTCDay() + 6) % 7;
  const lastDay = new Date(month);
  lastDay.setUTCMonth(month.getUTCMonth() + 1, 0);
  const days = lastDay.getUTCDate();
  const today = localDateValue();

  useEffect(() => {
    if (open) calendar.current?.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const moveMonth = (offset) => {
    setMonth((current) => {
      const next = new Date(current);
      next.setUTCMonth(next.getUTCMonth() + offset);
      return next;
    });
    setFocusDay(1);
  };
  const pick = (date) => {
    onChange(date);
    close();
  };

  return <div className="outing-date" onKeyDown={(event) => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }}>
    <label htmlFor={`${calendarId}-trigger`}>Fecha</label>
    <button
      ref={trigger}
      id={`${calendarId}-trigger`}
      type="button"
      className="outing-date-trigger"
      aria-expanded={open}
      aria-controls={open ? calendarId : undefined}
      aria-label={`Fecha: ${labelDate(value)}. ${open ? 'Cerrar' : 'Abrir'} calendario`}
      onClick={() => {
        if (!open) {
          setMonth(monthOf(value));
          setFocusDay(Number(value.slice(8)));
        }
        setOpen(!open);
      }}
    >
      <span>{labelDate(value)}</span>
      <img src="/assets/chippa/calendar-pink-check.png" alt="" />
    </button>
    {open && <div id={calendarId} className="outing-calendar" ref={calendar}>
      <div className="outing-calendar-header">
        <button type="button" aria-label="Mes anterior" onClick={() => moveMonth(-1)}>‹</button>
        <strong aria-live="polite">{monthName}</strong>
        <button type="button" aria-label="Mes siguiente" onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className="outing-calendar-grid" role="group" aria-label={`Días de ${monthName}`} onKeyDown={(event) => {
        const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
        if (!offset || !event.target.dataset.day) return;
        event.preventDefault();
        const next = Number(event.target.dataset.day) + offset;
        if (next >= 1 && next <= days) event.currentTarget.querySelector(`[data-day="${next}"]`)?.focus();
      }}>
        {week.map((day) => <span key={day} aria-hidden="true">{day}</span>)}
        {Array.from({ length: blanks }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const date = new Date(month);
          date.setUTCDate(day);
          const iso = date.toISOString().slice(0, 10);
          return <button key={iso} type="button"
            data-day={day}
            tabIndex={day === focusDay ? 0 : -1}
            onFocus={() => setFocusDay(day)}
            aria-label={labelDate(iso)}
            aria-pressed={iso === value}
            aria-current={iso === today ? 'date' : undefined}
            onClick={() => pick(iso)}
          >{day}</button>;
        })}
      </div>
      <button className="outing-calendar-today" type="button" onClick={() => pick(today)}>Elegir hoy</button>
    </div>}
  </div>;
}

export default function OutingForm({ friend, friends, friendsLoading, friendsError, onRetryFriends, onClose, onSubmit, busy }) {
  const [form, setForm] = useState(() => ({
    title: '', date: localDateValue(), place: destinations[0], description: '',
    emoji: marks[0].src, friendId: friend?.id || ''
  }));
  const [formError, setFormError] = useState('');
  const dialog = useRef(null);
  const titleInput = useRef(null);
  const friendOptions = [...new Map([...friends, ...(friend ? [friend] : [])].map((person) => [person.id, person])).values()];
  const selectedFriend = friendOptions.find((person) => person.id === form.friendId);
  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  useEffect(() => {
    const modal = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    titleInput.current?.focus({ preventScroll: true });
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.title.trim()) {
      setFormError('Escribe un nombre para la salida.');
      titleInput.current?.focus();
      return;
    }
    if (form.friendId && !selectedFriend) {
      setFormError('Ese amigo ya no está disponible. Elige a otra persona o crea la salida para ti.');
      return;
    }
    try {
      await onSubmit({ ...form, title: form.title.trim(), description: form.description.trim() });
    } catch (error) {
      setFormError(error.message || 'No pudimos crear la salida. Vuelve a intentarlo.');
    }
  };

  return <dialog
    className="modal-card outing-form-card"
    aria-labelledby="experience-heading"
    ref={dialog}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget || busy) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}
  >
    <header className="outing-form-header">
      <h2 id="experience-heading">Planea tu próxima salida</h2>
      <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose} disabled={busy}>×</button>
    </header>
    <form onSubmit={submit}>
      <fieldset className="outing-form-fields" disabled={busy}>
        <label>Nombre de la salida
          <input ref={titleInput} value={form.title} onChange={(event) => setField('title', event.target.value)}
            maxLength={100} placeholder="Una tarde en el parque" required />
        </label>
        <div className="outing-plan-fields">
          <OutingDateField value={form.date} onChange={(date) => setField('date', date)} />
          <label>Lugar
            <select value={form.place} onChange={(event) => setField('place', event.target.value)}>
              {destinations.map((place) => <option key={place}>{place}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="outing-mark-picker">
          <legend>Marca de la salida</legend>
          <div className="outing-mark-options">
            {marks.map(({ label, src }) => <label className="outing-mark-option" key={src}>
              <input type="radio" name="outing-mark" checked={form.emoji === src} onChange={() => setField('emoji', src)} />
              <img src={src} alt="" width="36" height="36" />
              <span>{label}</span>
            </label>)}
          </div>
        </fieldset>
        <label><span>Descripción <small className="outing-optional">(opcional)</small></span>
          <textarea rows="2" value={form.description} onChange={(event) => setField('description', event.target.value)}
            placeholder="¿Qué te gustaría hacer?" />
        </label>
        <fieldset className="outing-companion-picker">
          <legend>¿Con quién vas?</legend>
          <label className="outing-person-option">
            <input type="radio" name="outing-companion" checked={!form.friendId} onChange={() => setField('friendId', '')} />
            <span className="outing-person-avatar" aria-hidden="true">✦</span>
            <span>Solo para mí</span>
          </label>
          {!!friendOptions.length && <div className="outing-friend-list" role="group" aria-label="Tus amigos">
            {friendOptions.map((person) => <label className="outing-person-option" key={person.id}>
              <input type="radio" name="outing-companion" checked={form.friendId === person.id} onChange={() => setField('friendId', person.id)} />
              <span className="outing-person-avatar"><Avatar value={person.avatar} /></span>
              <span>{person.name}</span>
            </label>)}
          </div>}
          {friendsLoading && !friendOptions.length && <p role="status">Cargando tus amigos…</p>}
          {!friendsLoading && friendsError && <p>No pudimos cargar tus amigos. <button type="button" className="text-button" onClick={onRetryFriends}>Reintentar</button></p>}
          {!friendsLoading && !friendsError && !friendOptions.length && <p>Tus amigos aparecerán aquí cuando los agregues.</p>}
        </fieldset>
      </fieldset>
      <footer className="outing-form-footer">
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button type="submit" className="primary-button full-button" disabled={busy}>
          {busy ? 'Guardando…' : selectedFriend ? `Crear salida con ${selectedFriend.name}` : 'Crear salida solo para mí'}
        </button>
      </footer>
    </form>
  </dialog>;
}
