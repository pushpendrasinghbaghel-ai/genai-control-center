// GenAI Control Center - Main App Component
import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Header, ErrorBoundary } from "./components";
import { FilterProvider } from "./context";
import { 
  Home,
  HealthDashboard, 
  FinOps,
  Governance,
  Intelligence,
  Operations,
  ProviderComparison,
  AIArchitect,
  AITopology,
  ResponseAnalytics,
  PromptGovernance,
  RealTimeAlerts,
  AgentTools,
  ModelDrift,
  VectorDB,
  Infrastructure
} from "./pages";

export const App = () => {
  return (
    <ErrorBoundary>
      <FilterProvider>
        <Page>
          <Page.Header>
            <Header />
          </Page.Header>
          <Page.Main>
            <ErrorBoundary>
              <Routes>
                {/* Home: Executive Dashboard */}
                <Route path="/" element={<Home />} />
                
                {/* AI Services: Auto-discovery and monitoring */}
                <Route path="/services" element={<HealthDashboard />} />
                {/* Legacy route redirect */}
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
                
                {/* AI Topology Map - Visual representation of GenAI flows */}
                <Route path="/topology" element={<AITopology />} />
                
                {/* Response Analytics - Token efficiency and model comparison */}
                <Route path="/analytics" element={<ResponseAnalytics />} />
                
                {/* Prompt Governance - PII, injection, Davis AI scoring */}
                <Route path="/prompt-governance" element={<PromptGovernance />} />
                
                {/* GenAI Problems - Problems affecting AI services */}
                <Route path="/problems" element={<RealTimeAlerts />} />
                
                {/* Agent Tools - AI agent workflow monitoring */}
                <Route path="/agents" element={<AgentTools />} />
                
                {/* Model Drift Detection - Track behavior changes */}
                <Route path="/drift" element={<ModelDrift />} />

                {/* RAG / Vector DB Observability - Pinecone + Embeddings + TTFT + Retries */}
                <Route path="/vector-db" element={<VectorDB />} />

                {/* Infrastructure Health - Provider availability, Davis problems, deployments */}
                <Route path="/infrastructure" element={<Infrastructure />} />
                
                {/* Redirect old routes */}
                <Route path="/davis" element={<Navigate to="/intelligence" replace />} />
                <Route path="/remediation" element={<Navigate to="/operations" replace />} />
              </Routes>
            </ErrorBoundary>
          </Page.Main>
        </Page>
      </FilterProvider>
    </ErrorBoundary>
  );
};
