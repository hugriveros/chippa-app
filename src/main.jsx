import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './games.css';
import './progress.css';
import './friends.css';
import ErrorBoundary from './ErrorBoundary.jsx';
import { AppStateProvider } from './context/AppStateContext.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><ErrorBoundary><AppStateProvider><App /></AppStateProvider></ErrorBoundary></React.StrictMode>
);
