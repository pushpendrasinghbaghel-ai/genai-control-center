// GenAI Control Center - Navigation Header
// Navigation Pattern: Observe → Analyze → Act
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppHeader, HelpMenu } from "@dynatrace/strato-components/layouts";
import { Menu } from "@dynatrace/strato-components/navigation";
import { Button } from "@dynatrace/strato-components/buttons";
import { 
  HomeIcon,            // Home
  ServicesIcon,        // AI Services
  SmartscapeIcon,      // Topology
  BarChartIcon,        // Response Analytics / Quality
  LockIcon,            // Governance / Security
  MoneyIcon,           // FinOps
  AgentIcon,           // Agent Tools (AI agents)
  DifferenceChartIcon, // Model Drift (deviation/drift)
  CycleIcon,           // MLOps (ML lifecycle)
  DatabaseIcon,        // RAG / Vector DB
  HostsIcon,           // Infrastructure
  CodeIcon,            // Developer Experience
  AiIcon,              // Intelligence (Dynatrace Intelligence)
  DotMenuIcon,         // Overflow "more" menu
  SyncIcon,            // Provider Failover
  AutomationEngineIcon, // Operations
  ChatIcon,            // Conversation Intelligence
  GridIcon,            // AI Quality
} from '@dynatrace/strato-icons';

export const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
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

  // Check if any "More" page is currently active
  const morePages = ['/quality', '/conversation', '/devex', '/infrastructure', '/operations', '/problems', '/security', '/provider-status', '/providers', '/governance', '/ai-architect', '/integrations'];
  const isMoreActive = morePages.some(p => isActive(p));

  // Navigation follows Observe → Analyze → Act pattern
  return (
    <AppHeader>
      <AppHeader.NavItems>
        {/* App Home Link */}
        <AppHeader.AppNavLink as={Link} to="/" aria-label="GenAI Control Center Home" />
        
        {/* 1. Home: Executive Dashboard */}
        <AppHeader.NavItem as={Link} to="/" style={getNavItemStyle('/')} aria-label="Home Dashboard">
          <HomeIcon aria-hidden="true" /> Home
        </AppHeader.NavItem>
        
        {/* 2. Services: AI service discovery & health */}
        <AppHeader.NavItem as={Link} to="/services" style={getNavItemStyle('/services')} aria-label="AI Services">
          <ServicesIcon aria-hidden="true" /> Services
        </AppHeader.NavItem>

        {/* 3. FinOps: Cost Management */}
        <AppHeader.NavItem as={Link} to="/finops" style={getNavItemStyle('/finops')} aria-label="FinOps Cost Management">
          <MoneyIcon aria-hidden="true" /> FinOps
        </AppHeader.NavItem>
        
        {/* 4. Analytics: Token efficiency & response quality */}
        <AppHeader.NavItem as={Link} to="/analytics" style={getNavItemStyle('/analytics')} aria-label="Response Analytics">
          <BarChartIcon aria-hidden="true" /> Analytics
        </AppHeader.NavItem>
        
        {/* 5. Prompt Governance: PII, injection, Davis AI scoring */}
        <AppHeader.NavItem as={Link} to="/prompt-governance" style={getNavItemStyle('/prompt-governance')} aria-label="Prompt Governance">
          <LockIcon aria-hidden="true" /> Governance
        </AppHeader.NavItem>
        
        {/* 6. Topology: Service → Provider → Model relationships */}
        <AppHeader.NavItem as={Link} to="/topology" style={getNavItemStyle('/topology')} aria-label="AI Topology Map">
          <SmartscapeIcon aria-hidden="true" /> Topology
        </AppHeader.NavItem>
        
        {/* 7. Agents: AI agent & tool monitoring */}
        <AppHeader.NavItem as={Link} to="/agents" style={getNavItemStyle('/agents')} aria-label="Agent Tools">
          <AgentIcon aria-hidden="true" /> Agents
        </AppHeader.NavItem>
        
        {/* 8. RAG: Vector DB + Embeddings + pipeline health */}
        <AppHeader.NavItem as={Link} to="/vector-db" style={getNavItemStyle('/vector-db')} aria-label="RAG and Vector DB">
          <DatabaseIcon aria-hidden="true" /> RAG
        </AppHeader.NavItem>

        {/* 9. Drift: Model behavior tracking */}
        <AppHeader.NavItem as={Link} to="/drift" style={getNavItemStyle('/drift')} aria-label="Model Drift Detection">
          <DifferenceChartIcon aria-hidden="true" /> Drift
        </AppHeader.NavItem>

        {/* 10. Intelligence: Davis AI agentic chat */}
        <AppHeader.NavItem as={Link} to="/intelligence" style={getNavItemStyle('/intelligence')} aria-label="Dynatrace Intelligence">
          <AiIcon aria-hidden="true" /> Intelligence
        </AppHeader.NavItem>

        {/* 11. MLOps: ML lifecycle management */}
        <AppHeader.NavItem as={Link} to="/mlops" style={getNavItemStyle('/mlops')} aria-label="MLOps">
          <CycleIcon aria-hidden="true" /> MLOps
        </AppHeader.NavItem>

      </AppHeader.NavItems>

      {/* Overflow "More" menu for specialized pages */}
      <AppHeader.Menus>
        <Menu>
          <Menu.Trigger>
            <Button variant="default" aria-label="More pages">
              <DotMenuIcon aria-hidden="true" /> More {isMoreActive ? '●' : ''}
            </Button>
          </Menu.Trigger>
          <Menu.Content side="bottom" alignment="end">
            <Menu.Label>Observe</Menu.Label>
            <Menu.Item
              onSelect={() => navigate('/quality')}
              style={isActive('/quality') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><GridIcon /></Menu.Prefix>
              AI Quality
            </Menu.Item>
            <Menu.Item
              onSelect={() => navigate('/conversation')}
              style={isActive('/conversation') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><ChatIcon /></Menu.Prefix>
              Conversations
            </Menu.Item>
            <Menu.Item
              onSelect={() => navigate('/devex')}
              style={isActive('/devex') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><CodeIcon /></Menu.Prefix>
              Developer Experience
            </Menu.Item>
            <Menu.Item
              onSelect={() => navigate('/infrastructure')}
              style={isActive('/infrastructure') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><HostsIcon /></Menu.Prefix>
              Infrastructure
            </Menu.Item>

            <Menu.Label>Govern</Menu.Label>
            <Menu.Item
              onSelect={() => navigate('/governance')}
              style={isActive('/governance') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><LockIcon /></Menu.Prefix>
              Policies & Compliance
            </Menu.Item>

            <Menu.Label>Act</Menu.Label>
            <Menu.Item
              onSelect={() => navigate('/operations')}
              style={isActive('/operations') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><AutomationEngineIcon /></Menu.Prefix>
              Operations
            </Menu.Item>
            <Menu.Item
              onSelect={() => navigate('/security')}
              style={isActive('/security') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><LockIcon /></Menu.Prefix>
              Security Audit
            </Menu.Item>
            <Menu.Item
              onSelect={() => navigate('/provider-status')}
              style={isActive('/provider-status') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><SyncIcon /></Menu.Prefix>
              Provider Failover
            </Menu.Item>
            <Menu.Item
              onSelect={() => navigate('/integrations')}
              style={isActive('/integrations') ? { fontWeight: 600 } : {}}
            >
              <Menu.Prefix><AutomationEngineIcon /></Menu.Prefix>
              Integrations Hub
            </Menu.Item>

          </Menu.Content>
        </Menu>

        {/* HelpMenu - MANDATORY per Dynatrace Experience Standard */}
        <HelpMenu
          entries={{
            whatsNew: 'default',
            getStarted: {
              onSelect: () => window.open('https://developer.dynatrace.com', '_blank'),
            },
            documentation: [
              {
                label: 'GenAI Control Center Guide',
                href: 'https://developer.dynatrace.com',
                onSelect: () => undefined,
              },
              {
                label: 'GenAI Observability',
                href: 'https://docs.dynatrace.com/docs/platform-modules/automations/workflows/actions/genai',
                onSelect: () => undefined,
              },
              {
                label: 'Strato Design System',
                href: 'https://strato.dynatrace.com',
                onSelect: () => undefined,
              },
            ],
            keyboardShortcuts: 'default',
            feedback: {
              onSelect: () => {
                window.open('https://github.com/pushpendrasinghbaghel-ai/genai-control-center/issues', '_blank');
              },
            },
            about: 'default',
          }}
        />
      </AppHeader.Menus>

    </AppHeader>
  );
};
