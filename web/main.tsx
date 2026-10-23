import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/anek-latin/wdth.css';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/600.css';
import '@fontsource/mukta/700.css';
import './styles.css';
import { Soundbox } from './Soundbox.tsx';
import { Pay } from './Pay.tsx';
import { Ledger } from './Ledger.tsx';
import { Control } from './Control.tsx';

function App() {
  const path = location.pathname;
  if (path.startsWith('/pay/')) return <Pay refId={decodeURIComponent(path.slice(5))} />;
  if (path.startsWith('/ledger')) return <Ledger />;
  if (path.startsWith('/control')) return <Control />;
  return <Soundbox />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
