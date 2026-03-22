---
layout: default
title: Security Audit
parent: Act
---

# Security Audit Trail

**Route**: `/security`  
**Persona**: Security Officer, Compliance

## Use Cases

- **Security incident management**: Track and respond to AI-related security events
- **Audit compliance**: Maintain security audit logs for regulatory requirements
- **Threat detection**: Identify potential security threats in AI usage patterns

## Features

### Security Dashboard
- Active security incidents
- Threat severity distribution
- Response time metrics
- Compliance status

### Incident Timeline
- Chronological view of security events
- Severity classification
- Response status tracking
- Escalation history

### Auto-Response
- Automated security response workflows
- PII exposure mitigation
- Injection attack blocking
- Rate limit enforcement

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.prompt.0.content)` — Content analysis
- Pattern-based threat detection
- Integration with Dynatrace Workflows for automated response
