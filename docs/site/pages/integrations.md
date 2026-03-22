---
layout: default
title: Integrations Hub
parent: Act
---

# Integrations Hub

**Route**: `/integrations`  
**Persona**: Platform Engineer, SRE

## Use Cases

- **Unified notifications**: Configure alerts to Slack, PagerDuty, email
- **Cross-platform monitoring**: Import Prometheus/Grafana metrics
- **Cloud integration**: AWS billing and CloudWatch correlation
- **DevOps workflows**: GitHub issue creation and PR tracking

## Supported Integrations

### Communication
- **Slack** — Channel notifications for budget alerts, incidents, drift detection
- **PagerDuty** — Incident escalation with AI context

### Monitoring
- **Prometheus** — Import custom AI metrics via MCP
- **Grafana** — Dashboard synchronization
- **AWS CloudWatch** — Model invocation metrics correlation

### Cloud & DevOps
- **AWS Billing** — Bedrock/SageMaker cost correlation
- **GitHub** — Issue creation, commit attribution

### Configuration
Each integration provides:
- Connection status indicator
- Health check
- Configuration panel
- Test connection capability

## Architecture

Integrations use the MCP (Model Context Protocol) server architecture:
- MCP gateway handles routing
- Per-integration server modules
- Secure credential management
- Real-time health monitoring

## Data Sources

- MCP server endpoints for external data
- Dynatrace Document Service for integration configuration
- Webhook endpoints for incoming alerts
