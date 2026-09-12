import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { HubProvider } from './state/HubContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HubProvider>
      <App />
    </HubProvider>
  </StrictMode>,
);
