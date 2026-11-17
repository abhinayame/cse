import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthGate } from './components/AuthGate';
import './styles.css';

// Contributors on phones never download the CMS bundle, and vice versa.
const ReporterApp = lazy(() => import('./reporter/ReporterApp'));
const CMS = lazy(() => import('./App'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Reporter portal: mobile-first, for contributors. Same backend and login. */}
        <Route path="/reporter/*" element={<Suspense fallback={null}><ReporterApp /></Suspense>} />
        <Route path="/*" element={<AuthGate><Suspense fallback={null}><CMS /></Suspense></AuthGate>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
