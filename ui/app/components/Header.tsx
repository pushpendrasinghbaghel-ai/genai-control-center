// GenAI Control Center - Navigation Header
// Navigation Pattern: Observe → Analyze → Act
// Home → FinOps → Analytics → Governance → Topology → Services → Agents → Intelligence → Operations
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";
import { 
  HomeIcon, 
  ServicesIcon,        // AI Services
  SmartscapeIcon,      // Topology
  BarChartIcon,        // Response Analytics
  LockIcon,            // Prompt Governance
  MoneyIcon,           // FinOps
  AgentIcon,           // Agent Tools (AI agents)
  ResearchIcon,        // Model Drift
  DatabaseIcon,        // RAG / Vector DB
  HostsIcon,           // Infrastructure
  CodeIcon,            // Developer Experience
  AiIcon,              // Intelligence (Dynatrace Intelligence)
} from '@dynatrace/strato-icons';

export const Header = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Helper to check if a path is active
  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  // Active tab style
  const getNavItemStyle = (path: string) => ({
    backgroundColor: isActive(path) ? 'var(--dt-colors-surface-primary-default)' : 'transparent',
    borderRadius: '4px',
    color: isActive(path) ? 'var(--dt-colors-text-primary-default)' : 'inherit',
    fontWeight: isActive(path) ? 600 : 400,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  });

  // Navigation follows Observe → Analyze → Act pattern
  // Home → FinOps → Analytics → Governance → Topology → Health → Agents → Intelligence → Operations
  return (
    <AppHeader>
      <AppHeader.NavItems>
        {/* App Home Link */}
        <AppHeader.AppNavLink as={Link} to="/" aria-label="GenAI Control Center Home" />
        
        {/* 1. Home: Executive Dashboard - Entry point */}
        <AppHeader.NavItem as={Link} to="/" style={getNavItemStyle('/')} aria-label="Home Dashboard">
          <HomeIcon aria-hidden="true" /> Home
        </AppHeader.NavItem>
        
        {/* 2. FinOps: Cost Management - "How much are we spending?" */}
        <AppHeader.NavItem as={Link} to="/finops" style={getNavItemStyle('/finops')} aria-label="FinOps Cost Management">
          <MoneyIcon aria-hidden="true" /> FinOps
        </AppHeader.NavItem>
        
        {/* 3. Analytics: Token efficiency - "Are we using AI efficiently?" */}
        <AppHeader.NavItem as={Link} to="/analytics" style={getNavItemStyle('/analytics')} aria-label="Response Analytics">
          <BarChartIcon aria-hidden="true" /> Analytics
        </AppHeader.NavItem>
        
        {/* 4. Governance: Compliance & policies - "Are we compliant?" */}
        <AppHeader.NavItem as={Link} to="/prompt-governance" style={getNavItemStyle('/prompt-governance')} aria-label="Prompt Governance">
          <LockIcon aria-hidden="true" /> Governance
        </AppHeader.NavItem>
        
        {/* 5. Topology: Service relationships - "What's connected?" */}
        <AppHeader.NavItem as={Link} to="/topology" style={getNavItemStyle('/topology')} aria-label="AI Topology Map">
          <SmartscapeIcon aria-hidden="true" /> Topology
        </AppHeader.NavItem>
        
        {/* 6. Services: AI services overview - "What services are using AI?" */}
        <AppHeader.NavItem as={Link} to="/services" style={getNavItemStyle('/services')} aria-label="AI Services">
          <ServicesIcon aria-hidden="true" /> Services
        </AppHeader.NavItem>
        
        {/* 7. Agents: AI agent tool monitoring - "How are agents behaving?" */}
        <AppHeader.NavItem as={Link} to="/agents" style={getNavItemStyle('/agents')} aria-label="Agent Tools">
          <AgentIcon aria-hidden="true" /> Agents
        </AppHeader.NavItem>
        
        {/* 8. Drift: Model behavior tracking - "Are models changing?" */}
        <AppHeader.NavItem as={Link} to="/drift" style={getNavItemStyle('/drift')} aria-label="Model Drift Detection">
          <ResearchIcon aria-hidden="true" /> Drift
        </AppHeader.NavItem>
        
        {/* 9. RAG: Vector DB + Embeddings + TTFT - "How is our RAG pipeline performing?" */}
        <AppHeader.NavItem as={Link} to="/vector-db" style={getNavItemStyle('/vector-db')} aria-label="RAG and Vector DB">
          <DatabaseIcon aria-hidden="true" /> RAG
        </AppHeader.NavItem>

        {/* 10. Infrastructure: Provider availability + Davis problems */}
        <AppHeader.NavItem as={Link} to="/infrastructure" style={getNavItemStyle('/infrastructure')} aria-label="AI Infrastructure Health">
          <HostsIcon aria-hidden="true" /> Infra
        </AppHeader.NavItem>

        {/* 11. DevEx: Instrumentation coverage, shadow AI, code attribution */}
        <AppHeader.NavItem as={Link} to="/devex" style={getNavItemStyle('/devex')} aria-label="Developer Experience">
          <CodeIcon aria-hidden="true" /> DevEx
        </AppHeader.NavItem>

        {/* 12. Intelligence: Dynatrace Intelligence chat - agentic deep-dive analysis */}
        <AppHeader.NavItem as={Link} to="/intelligence" style={getNavItemStyle('/intelligence')} aria-label="Dynatrace Intelligence">
          <AiIcon aria-hidden="true" /> Intelligence
        </AppHeader.NavItem>
        

      </AppHeader.NavItems>
    </AppHeader>
  );
};
