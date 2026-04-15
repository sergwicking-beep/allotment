import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import Layout from './components/Layout';

// Lazy-load pages — filled in per chunk
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const PlotLayout     = lazy(() => import('./pages/PlotLayout'));
const CropBrowser    = lazy(() => import('./pages/CropBrowser'));
const CropDetail     = lazy(() => import('./pages/CropDetail'));
const Calendar       = lazy(() => import('./pages/Calendar'));
const Rotation       = lazy(() => import('./pages/Rotation'));
const ColdFrame      = lazy(() => import('./pages/ColdFrame'));
const SeedStock      = lazy(() => import('./pages/SeedStock'));
const Settings       = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return <div className="spinner" />;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/plot"        element={<PlotLayout />} />
              <Route path="/crops"       element={<CropBrowser />} />
              <Route path="/crops/:id"   element={<CropDetail />} />
              <Route path="/calendar"    element={<Calendar />} />
              <Route path="/rotation"    element={<Rotation />} />
              <Route path="/cold-frame"  element={<ColdFrame />} />
              <Route path="/seeds"       element={<SeedStock />} />
              <Route path="/settings"    element={<Settings />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
