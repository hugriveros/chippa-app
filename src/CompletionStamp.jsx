export default function CompletionStamp({ compact = false }) {
  return <span className={`chippa-stamp ${compact ? 'compact' : ''}`} role="img" aria-label="Actividad completada, timbre de CHIPPA"><span>CHIPPA</span><b>✓</b><small>COMPLETADA</small></span>;
}
