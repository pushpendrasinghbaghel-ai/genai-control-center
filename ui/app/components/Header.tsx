// GenAI Control Center - Navigation Header
// Industry-standard naming: Overview, FinOps, Governance, Intelligence, Operations
import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";

export const Header = () => {
  return (
    <AppHeader>
      <AppHeader.NavItems>
        {/* App Home Link */}
        <AppHeader.AppNavLink as={Link} to="/" />
        
        {/* Overview: Health Dashboard */}
        <AppHeader.NavItem as={Link} to="/">
          Overview
        </AppHeader.NavItem>
        
        {/* FinOps: AI Cost Management */}
        <AppHeader.NavItem as={Link} to="/finops">
          FinOps
        </AppHeader.NavItem>
        
        {/* Governance: Compliance & Risk */}
        <AppHeader.NavItem as={Link} to="/governance">
          Governance
        </AppHeader.NavItem>
        
        {/* Intelligence: AI-Powered Investigation */}
        <AppHeader.NavItem as={Link} to="/intelligence">
          Intelligence
        </AppHeader.NavItem>
        
        {/* Operations: Runbooks & Remediation */}
        <AppHeader.NavItem as={Link} to="/operations">
          Operations
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
