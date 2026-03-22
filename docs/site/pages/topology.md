---
layout: default
title: AI Topology
parent: Observe
---

# AI Topology

**Route**: `/topology`  
**Persona**: Platform Engineer, SRE

## Use Cases

- **Dependency mapping**: Visualize how services connect to providers and models
- **Impact analysis**: Understand blast radius when a provider has an outage
- **Architecture review**: See the full AI service topology at a glance

## Features

### Interactive Topology Map
Visual node-link diagram showing:
- **Service nodes**: Your application services
- **Provider nodes**: AI providers (OpenAI, Anthropic, etc.)
- **Model nodes**: Specific models (gpt-4o, claude-3-opus, etc.)
- **Edges**: Request volume and latency between nodes

### Node Details
Click any node to see:
- Request volume and trends
- Latency metrics
- Error rates
- Connected upstream/downstream services

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.request.model)` — Relationship discovery
- `summarize by: { dt.entity.service, gen_ai.system, gen_ai.request.model }` — Edge weights
