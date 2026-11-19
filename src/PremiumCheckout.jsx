import { useEffect, useRef, useState } from 'react';
import { LockIcon } from './GamesHub.jsx';

export default function PremiumCheckout({ item, active, onClose, onActivate, onCancel, onFree }) {
  const dialog = useRef(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!item) return undefined;
    setAccepted(false); setBusy(false); setError('');
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => { document.body.style.overflow = overflow; before?.focus(); };
  }, [item]);
  if (!item) return null;
  const activate = async (event) => {
    event.preventDefault(); if (!accepted || busy) return;
    setBusy(true); setError('');
    try { await onActivate(); } catch (failure) { setError(failure.message || 'No pudimos guardar la suscripción. Intenta nuevamente.'); setBusy(false); }
  };
  return <dialog ref={dialog} className="premium-dialog" aria-labelledby="premium-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}>
    <button className="modal-close" disabled={busy} onClick={onClose} aria-label="Cerrar">×</button><span className="premium-dialog-icon"><LockIcon /></span><div className="eyebrow">CHIPPA PREMIUM</div><h2 id="premium-title">{active ? 'Tu colección, sin límites.' : 'Más formas de seguir su historia.'}</h2><p>{active ? 'Tienes todas las experiencias Premium desbloqueadas.' : `Desbloquea ${item.id === 'subscription' ? 'todas las actividades' : item.title} y el resto de la colección Premium.`}</p>
    <ul className="premium-features"><li>Todos los juegos y sus rondas completas</li><li>Cartas del futuro y playlist</li><li>Aventuras y generador de planes</li></ul>
    <div className="simulation-total"><span>{active ? 'Suscripción simulada activa' : 'Pago de prueba'}</span><b>$0</b><small>Sin cobros ni renovación automática.</small></div>
    {active ? <><button className="primary-button" onClick={onClose}>Seguir explorando →</button><button className="text-button" onClick={onCancel}>Volver al plan Free</button></> : <form onSubmit={activate}><label className="simulation-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />Entiendo que el pago es simulado y no se solicita una tarjeta real.</label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button full-button" disabled={!accepted || busy}>{busy ? 'Activando…' : 'Simular pago y activar Premium →'}</button><button type="button" className="text-button" disabled={busy} onClick={onFree}>Explorar actividades Free</button></form>}
  </dialog>;
}
