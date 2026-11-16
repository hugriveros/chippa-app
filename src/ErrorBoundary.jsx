import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="loading-screen"><img src="/assets/chippa/brand.png" alt="CHIPPA" width="140" /><h1>Volvamos a tu historia.</h1><p>No pudimos mostrar esta pantalla. Puedes recargar para continuar.</p><button className="primary-button" onClick={() => window.location.reload()}>Volver a cargar</button></main>;
    return this.props.children;
  }
}
