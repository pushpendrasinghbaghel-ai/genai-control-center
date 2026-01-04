// GenAI Control Center - Main App Component
import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { 
  HealthDashboard, 
  FinOps,
  Governance,
  Intelligence,
  Operations
} from "./pages";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          {/* Overview: Health Dashboard - Auto-discovery and monitoring */}
          <Route path="/" element={<HealthDashboard />} />
          
          {/* FinOps: AI Cost Management and Optimization */}
          <Route path="/finops" element={<FinOps />} />
          
          {/* Governance: Compliance, Risk, and Policy Management */}
          <Route path="/governance" element={<Governance />} />
          
          {/* Intelligence: AI-Powered Investigation and Analysis */}
          <Route path="/intelligence" element={<Intelligence />} />
          
          {/* Operations: Runbooks and Remediation */}
          <Route path="/operations" element={<Operations />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
