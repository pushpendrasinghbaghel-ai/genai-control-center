// GenAI Control Center - Navigation Header
// Following Dynatrace Navigation Guidelines: Clean flat navigation with 7 items
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";
import { 
  HomeIcon, 
  HeartIcon,           // Health dashboard
  SmartscapeIcon,      // Topology
  BarChartIcon,        // Response Analytics
  LockIcon,            // Prompt Governance
  MoneyIcon,           // FinOps
  AiIcon,              // Intelligence
  WorkflowsIcon        // Operations
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

  return (
    <AppHeader>
      <AppHeader.NavItems>
        {/* App Home Link */}
        <AppHeader.AppNavLink as={Link} to="/" aria-label="GenAI Control Center Home" />
        
        {/* Home: Executive Dashboard */}
        <AppHeader.NavItem as={Link} to="/" style={getNavItemStyle('/')} aria-label="Home Dashboard">
          <HomeIcon aria-hidden="true" /> Home
        </AppHeader.NavItem>
        
        {/* Health Dashboard */}
        <AppHeader.NavItem as={Link} to="/health" style={getNavItemStyle('/health')} aria-label="Health Dashboard">
          <HeartIcon aria-hidden="true" /> Health
        </AppHeader.NavItem>
        
        {/* Topology Map */}
        <AppHeader.NavItem as={Link} to="/topology" style={getNavItemStyle('/topology')} aria-label="AI Topology Map">
          <SmartscapeIcon aria-hidden="true" /> Topology
        </AppHeader.NavItem>
        
        {/* Response Analytics */}
        <AppHeader.NavItem as={Link} to="/analytics" style={getNavItemStyle('/analytics')} aria-label="Response Analytics">
          <BarChartIcon aria-hidden="true" /> Analytics
        </AppHeader.NavItem>
        
        {/* Prompt Governance */}
        <AppHeader.NavItem as={Link} to="/prompt-governance" style={getNavItemStyle('/prompt-governance')} aria-label="Prompt Governance">
          <LockIcon aria-hidden="true" /> Governance
        </AppHeader.NavItem>
        
        {/* FinOps */}
        <AppHeader.NavItem as={Link} to="/finops" style={getNavItemStyle('/finops')} aria-label="FinOps Cost Management">
          <MoneyIcon aria-hidden="true" /> FinOps
        </AppHeader.NavItem>
        
        {/* Intelligence */}
        <AppHeader.NavItem as={Link} to="/intelligence" style={getNavItemStyle('/intelligence')} aria-label="AI Intelligence">
          <AiIcon aria-hidden="true" /> Intelligence
        </AppHeader.NavItem>
        
        {/* Operations */}
        <AppHeader.NavItem as={Link} to="/operations" style={getNavItemStyle('/operations')} aria-label="Operations and Automation">
          <WorkflowsIcon aria-hidden="true" /> Operations
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
