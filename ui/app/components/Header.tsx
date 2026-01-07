// GenAI Control Center - Navigation Header
// Consolidated navigation with all pillars
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";

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
  });

  return (
    <AppHeader>
      <AppHeader.NavItems>
        {/* App Home Link */}
        <AppHeader.AppNavLink as={Link} to="/" />
        
        {/* Home: Executive Dashboard */}
        <AppHeader.NavItem as={Link} to="/" style={getNavItemStyle('/')}>
          🏠 Home
        </AppHeader.NavItem>
        
        {/* Health Dashboard: Service Health & Monitoring */}
        <AppHeader.NavItem as={Link} to="/health" style={getNavItemStyle('/health')}>
          📊 Health
        </AppHeader.NavItem>
        
        {/* NEW: AI Topology Map */}
        <AppHeader.NavItem as={Link} to="/topology" style={getNavItemStyle('/topology')}>
          🗺️ Topology
        </AppHeader.NavItem>
        
        {/* NEW: AI Quality Intelligence */}
        <AppHeader.NavItem as={Link} to="/quality" style={getNavItemStyle('/quality')}>
          🎯 Quality
        </AppHeader.NavItem>
        
        {/* FinOps: AI Cost Management */}
        <AppHeader.NavItem as={Link} to="/finops" style={getNavItemStyle('/finops')}>
          💰 FinOps
        </AppHeader.NavItem>
        
        {/* Governance: Compliance & Risk */}
        <AppHeader.NavItem as={Link} to="/governance" style={getNavItemStyle('/governance')}>
          🛡️ Governance
        </AppHeader.NavItem>
        
        {/* GenAI Problems */}
        <AppHeader.NavItem as={Link} to="/problems" style={getNavItemStyle('/problems')}>
          Problems
        </AppHeader.NavItem>
        
        {/* Intelligence: AI-Powered Investigation */}
        <AppHeader.NavItem as={Link} to="/intelligence" style={getNavItemStyle('/intelligence')}>
          🧠 Intelligence
        </AppHeader.NavItem>
        
        {/* Operations: Runbooks & Automation */}
        <AppHeader.NavItem as={Link} to="/operations" style={getNavItemStyle('/operations')}>
          ⚡ Operations
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
