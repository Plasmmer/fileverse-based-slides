import React from 'react';
import './slides.css';
import ReactDOM from 'react-dom/client';
import { DSlidesEditor } from '../../src/slides';

function SlidesDemo() {
  const [presentationId] = React.useState(() => {
    const params = new URLSearchParams(window.location.search);
    const suppliedId = params.get('presentation');
    if (suppliedId) return suppliedId;

    const randomId = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
    return 'demo-' + randomId;
  });

  return (
    <main style={{ width: '100vw', height: '100vh' }}>
      <DSlidesEditor presentationId={presentationId} />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SlidesDemo />
  </React.StrictMode>,
);
