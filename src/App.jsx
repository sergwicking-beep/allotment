import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import Layout from './components/Layout';

const Track      = lazy(() => import('./pages/Track'));
const PlotLayout = lazy(() => import('./pages/PlotLayout'));
const Plan       = lazy(() => import('./pages/Plan'));
const CropDetail = lazy(() => import('./pages/CropDetail'));
const Settings   = lazy(() => import('./pages/Settings'));

// Legacy pages — still reachable by direct URL but not in the main nav
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const CropBrowser = lazy(() => import('./pages/CropBrowser'));
const Calendar   = lazy(() => import('./pages/Calendar'));
const Rotation   = lazy(() => import('./pages/Rotation'));
const ColdFrame  = lazy(() => import('./pages/ColdFrame'));
const SeedStock  = lazy(() => import('./pages/SeedStock'));

function PageFallback() {
  return <div className="spinner" />;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Main 3-tab routes */}
              <Route path="/"          element={<Track />} />
              <Route path="/plot"      element={<PlotLayout />} />
              <Route path="/plan"      element={<Plan />} />

              {/* Crop detail — linked from bed panels */}
              <Route path="/crops/:id" element={<CropDetail />} />

              {/* Settings */}
              <Route path="/settings"  element={<Settings />} />

              {/* Legacy routes — accessible by URL, not shown in nav */}
              <Route path="/dashboard"  element={<Dashboard />} />
              <Route path="/crops"      element={<CropBrowser />} />
              <Route path="/calendar"   element={<Calendar />} />
              <Route path="/rotation"   element={<Rotation />} />
              <Route path="/cold-frame" element={<ColdFrame />} />
              <Route path="/seeds"      element={<SeedStock />} />
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
    </AppProvider>
  );
}
