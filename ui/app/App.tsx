// GenAI Control Center - Main App Component
import { Page } from "@dynatrace/strato-components/layouts";
import React, { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { Header, ErrorBoundary } from "./components";
import { FilterProvider } from "./context";
import { syncRateCardFromGrail } from "./utils/helpers";
import { 
  Home,
  HealthDashboard, 
  FinOps,
  Governance,
  Intelligence,
  Operations,
  AIArchitect,
  AITopology,
  PromptGovernance,
  AgentTools,
  ModelDrift,
  VectorDB,
  ResponseAnalytics,
  AIQualityDashboard,
  ConversationIntelligence,
  Infrastructure,
  DeveloperExperience,
  SecurityAuditTrail,
  ProviderStatus,
  Integrations,
  MLOps,
  Data,
  ThreatIntelligence,
} from "./pages";

export const App = () => {
  // Sync rate card config from Grail on startup
  useEffect(() => {
    syncRateCardFromGrail().catch(() => {});
  }, []);

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
                
                {/* Provider Comparison: Redirect to Provider Status */}
                <Route path="/providers" element={<Navigate to="/provider-status" replace />} />
                
                {/* AI Architect: Pattern Detection & Recommendations */}
                <Route path="/ai-architect" element={<AIArchitect />} />
                
                {/* Intelligence: AI-Powered Investigation and Analysis */}
                <Route path="/intelligence" element={<Intelligence />} />
                
                {/* Operations: Runbooks and Remediation */}
                <Route path="/operations" element={<Operations />} />
                
                {/* AI Topology Map - Visual representation of GenAI flows */}
                <Route path="/topology" element={<AITopology />} />
                
                {/* Response Analytics: Token efficiency, model ranking, output consistency */}
                <Route path="/analytics" element={<ResponseAnalytics />} />
                
                {/* Prompt Governance - PII, injection, Davis AI scoring */}
                <Route path="/prompt-governance" element={<PromptGovernance />} />
                
                {/* GenAI Problems - redirect to Operations (consolidated) */}
                <Route path="/problems" element={<Navigate to="/operations" replace />} />
                
                {/* Agent Tools - AI agent workflow monitoring */}
                <Route path="/agents" element={<AgentTools />} />
                
                {/* Model Drift Detection - Track behavior changes */}
                <Route path="/drift" element={<ModelDrift />} />

                {/* RAG / Vector DB Observability - Pinecone + Embeddings + TTFT + Retries */}
                <Route path="/vector-db" element={<VectorDB />} />

                {/* Infrastructure Health: Service config snapshot, model version history */}
                <Route path="/infrastructure" element={<Infrastructure />} />

                {/* AI Quality Dashboard: Industry-standard quality scoring */}
                <Route path="/quality" element={<AIQualityDashboard />} />

                {/* Conversation Intelligence: Session-level AI observability */}
                <Route path="/conversation" element={<ConversationIntelligence />} />

                {/* Developer Experience - Instrumentation coverage, shadow AI, code attribution */}
                <Route path="/devex" element={<DeveloperExperience />} />

                {/* Security Audit Trail - Prompt security, PII detection, incident response */}
                <Route path="/security" element={<SecurityAuditTrail />} />

                {/* Adversarial Prompt Threat Intelligence - Davis AI semantic attack detection */}
                <Route path="/threat-intelligence" element={<ThreatIntelligence />} />

                {/* Provider Status & Failover - Phase 5: Provider health, failover readiness */}
                <Route path="/provider-status" element={<ProviderStatus />} />

                {/* Integrations Hub - Phase 10: MCP integrations dashboard */}
                <Route path="/integrations" element={<Integrations />} />

                {/* MLOps - Model Registry, SLOs, Comparison, Cost Attribution */}
                <Route path="/mlops" element={<MLOps />} />

                {/* Agentic Deep Dive - Merged into Agent Tools */}
                <Route path="/agentic" element={<Navigate to="/agents" replace />} />

                {/* Data Playground - DQL editor and preset queries */}
                <Route path="/data" element={<Data />} />

                
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
