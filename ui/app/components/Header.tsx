// GenAI Control Center - Navigation Header
// Consolidated navigation with all pillars
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";
import { 
  HomeIcon, 
  BarChartIcon,        // Health dashboard
  SmartscapeIcon,      // Topology
  ServiceLevelObjectivesIcon, // Quality
  MoneyIcon,           // FinOps
  SecurityIcon,        // Governance
  WarningIcon,         // Problems
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
        <AppHeader.AppNavLink as={Link} to="/" />
        
        {/* Home: Executive Dashboard */}
        <AppHeader.NavItem as={Link} to="/" style={getNavItemStyle('/')}>
          <HomeIcon /> Home
        </AppHeader.NavItem>
        
        {/* Health Dashboard: Service Health & Monitoring */}
        <AppHeader.NavItem as={Link} to="/health" style={getNavItemStyle('/health')}>
          <BarChartIcon /> Health
        </AppHeader.NavItem>
        
        {/* AI Topology Map */}
        <AppHeader.NavItem as={Link} to="/topology" style={getNavItemStyle('/topology')}>
          <SmartscapeIcon /> Topology
        </AppHeader.NavItem>
        
        {/* AI Quality Intelligence */}
        <AppHeader.NavItem as={Link} to="/quality" style={getNavItemStyle('/quality')}>
          <ServiceLevelObjectivesIcon /> Quality
        </AppHeader.NavItem>
        
        {/* FinOps: AI Cost Management */}
        <AppHeader.NavItem as={Link} to="/finops" style={getNavItemStyle('/finops')}>
          <MoneyIcon /> FinOps
        </AppHeader.NavItem>
        
        {/* Governance: Compliance & Risk */}
        <AppHeader.NavItem as={Link} to="/governance" style={getNavItemStyle('/governance')}>
          <SecurityIcon /> Governance
        </AppHeader.NavItem>
        
        {/* GenAI Problems */}
        <AppHeader.NavItem as={Link} to="/problems" style={getNavItemStyle('/problems')}>
          <WarningIcon /> Problems
        </AppHeader.NavItem>
        
        {/* Intelligence: AI-Powered Investigation */}
        <AppHeader.NavItem as={Link} to="/intelligence" style={getNavItemStyle('/intelligence')}>
          <AiIcon /> Intelligence
        </AppHeader.NavItem>
        
        {/* Operations: Runbooks & Automation */}
        <AppHeader.NavItem as={Link} to="/operations" style={getNavItemStyle('/operations')}>
          <WorkflowsIcon /> Operations
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
