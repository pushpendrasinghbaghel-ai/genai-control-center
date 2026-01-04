// GenAI Control Center - Navigation Header
// Industry-standard naming: Overview, FinOps, Governance, Intelligence, Operations
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
        
        {/* Overview: Health Dashboard */}
        <AppHeader.NavItem as={Link} to="/" style={getNavItemStyle('/')}>
          Overview
        </AppHeader.NavItem>
        
        {/* FinOps: AI Cost Management */}
        <AppHeader.NavItem as={Link} to="/finops" style={getNavItemStyle('/finops')}>
          FinOps
        </AppHeader.NavItem>
        
        {/* Governance: Compliance & Risk */}
        <AppHeader.NavItem as={Link} to="/governance" style={getNavItemStyle('/governance')}>
          Governance
        </AppHeader.NavItem>
        
        {/* Intelligence: AI-Powered Investigation */}
        <AppHeader.NavItem as={Link} to="/intelligence" style={getNavItemStyle('/intelligence')}>
          Intelligence
        </AppHeader.NavItem>
        
        {/* Operations: Runbooks & Remediation */}
        <AppHeader.NavItem as={Link} to="/operations" style={getNavItemStyle('/operations')}>
          Operations
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
