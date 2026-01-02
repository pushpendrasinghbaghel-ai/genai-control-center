// GenAI Control Center - Navigation Header
import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";

export const Header = () => {
  return (
    <AppHeader>
      <AppHeader.NavItems>
        {/* App Home Link */}
        <AppHeader.AppNavLink as={Link} to="/" />
        
        {/* Pillar A: Health Dashboard */}
        <AppHeader.NavItem as={Link} to="/">
          Health Dashboard
        </AppHeader.NavItem>
        
        {/* Pillar B: AI Architect */}
        <AppHeader.NavItem as={Link} to="/architect">
          AI Architect
        </AppHeader.NavItem>
        
        {/* Pillar C: Davis Assistant */}
        <AppHeader.NavItem as={Link} to="/davis">
          Davis Assistant
        </AppHeader.NavItem>
        
        {/* Pillar D: Remediation Library */}
        <AppHeader.NavItem as={Link} to="/remediation">
          Remediation
        </AppHeader.NavItem>
        
        {/* Provider Comparison */}
        <AppHeader.NavItem as={Link} to="/providers">
          Providers
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
