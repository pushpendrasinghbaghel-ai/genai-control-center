// GenAI Control Center - Main App Component
import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Header } from "./components/Header";
import { 
  Home,
  HealthDashboard, 
  FinOps,
  Governance,
  Intelligence,
  Operations,
  ProviderComparison,
  AIArchitect
} from "./pages";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          {/* Home: Executive Dashboard */}
          <Route path="/" element={<Home />} />
          
          {/* Health Dashboard: Auto-discovery and monitoring */}
          <Route path="/health" element={<HealthDashboard />} />
          
          {/* FinOps: AI Cost Management and Optimization */}
          <Route path="/finops" element={<FinOps />} />
          
          {/* Governance: Compliance, Risk, and Policy Management */}
          <Route path="/governance" element={<Governance />} />
          
          {/* Provider Comparison: Cross-provider analysis */}
          <Route path="/providers" element={<ProviderComparison />} />
          
          {/* AI Architect: Pattern Detection & Recommendations */}
          <Route path="/ai-architect" element={<AIArchitect />} />
          
          {/* Intelligence: AI-Powered Investigation and Analysis */}
          <Route path="/intelligence" element={<Intelligence />} />
          
          {/* Operations: Runbooks and Remediation */}
          <Route path="/operations" element={<Operations />} />
          
          {/* Redirect old routes */}
          <Route path="/davis" element={<Navigate to="/intelligence" replace />} />
          <Route path="/remediation" element={<Navigate to="/operations" replace />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
