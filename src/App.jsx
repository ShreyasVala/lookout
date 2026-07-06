import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const Family = lazy(() => import('./pages/Family.jsx'));
const ReportPage = lazy(() => import('./pages/ReportPage.jsx'));
const ReportDetail = lazy(() => import('./pages/ReportDetail.jsx'));
const ScanPage = lazy(() => import('./pages/ScanPage.jsx'));
const FinderFlow = lazy(() => import('./pages/FinderFlow.jsx'));
const FoundNoTag = lazy(() => import('./pages/FoundNoTag.jsx'));
const FoundReportPage = lazy(() => import('./pages/FoundReportPage.jsx'));
const AlertsPage = lazy(() => import('./pages/AlertsPage.jsx'));
const MapPage = lazy(() => import('./pages/MapPage.jsx'));

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="container">
        <Suspense fallback={<div className="empty">Loading Lookout...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/family" element={<Family />} />
            <Route path="/report/new" element={<ReportPage />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/finder/:reportId" element={<FinderFlow />} />
            <Route path="/found" element={<FoundNoTag />} />
            <Route path="/found/report" element={<FoundReportPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="footer">
        <p>
          Lookout is a demo project — all data is fictional and simulated. In a
          real emergency, always contact local police first.
        </p>
      </footer>
    </div>
  );
}
