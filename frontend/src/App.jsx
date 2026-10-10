import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import EditorPage from './pages/EditorPage';
import LearnPage from './pages/LearnPage';
import CommunityPage from './pages/CommunityPage';
import AboutPage from './pages/AboutPage';
import SupportPage from './pages/SupportPage';
import AutoCadPage from './pages/AutoCadPage';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const renderEditor = () => (
    <ErrorBoundary name="CAD Studio">
      <EditorPage />
    </ErrorBoundary>
  );

  const renderAutoCad = () => (
    <ErrorBoundary name="AutoCAD Studio">
      <AutoCadPage />
    </ErrorBoundary>
  );

  return (
    <Routes>
      {/* 1. Global Marketing & Platform Hierarchy */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/projects" element={<HomePage />} />
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/support" element={<SupportPage />} />

      {/* 2. AutoCAD Direct Drafting Studio Routes */}
      <Route path="/drafting" element={renderAutoCad()} />
      <Route path="/drafting/:id" element={renderAutoCad()} />
      <Route path="/projects/:id/drafting" element={renderAutoCad()} />
      <Route path="/projects/:projectId/drafting" element={renderAutoCad()} />
      <Route path="/autocad" element={renderAutoCad()} />

      {/* 3. CAD Studio Workspace Routes */}
      <Route path="/projects/:id/cad" element={renderEditor()} />
      <Route path="/projects/:projectId/cad" element={renderEditor()} />
      <Route path="/projects/:id" element={renderEditor()} />
      <Route path="/projects/:projectId" element={renderEditor()} />
      <Route path="/editor/:id" element={renderEditor()} />
      <Route path="/editor/:projectId" element={renderEditor()} />
      <Route path="/editor" element={renderEditor()} />

      {/* 4. Fallback Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
