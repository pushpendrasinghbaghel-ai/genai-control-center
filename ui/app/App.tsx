// GenAI Control Center - Main App Component
import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { 
  HealthDashboard, 
  AIArchitect, 
  DavisAssistant, 
  RemediationLibrary,
  ProviderComparison 
} from "./pages";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          {/* Pillar A: Health Dashboard - Auto-discovery and health monitoring */}
          <Route path="/" element={<HealthDashboard />} />
          
          {/* Pillar B: AI Architect - Pattern detection and recommendations */}
          <Route path="/architect" element={<AIArchitect />} />
          
          {/* Pillar C: Davis Assistant - Chat-based deep dive analysis */}
          <Route path="/davis" element={<DavisAssistant />} />
          
          {/* Pillar D: Remediation Library - One-click automation */}
          <Route path="/remediation" element={<RemediationLibrary />} />
          
          {/* Provider Comparison - Unified governance view */}
          <Route path="/providers" element={<ProviderComparison />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
