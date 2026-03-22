---
layout: default
title: Conversations
parent: Observe
---

# Conversation Intelligence

**Route**: `/conversation`  
**Persona**: ML Engineer, Product Manager

## Use Cases

- **Session monitoring**: Track multi-turn AI conversation sessions
- **Conversation quality**: Measure engagement, turn count, and completion rates
- **User behavior**: Understand how users interact with AI services

## Features

### Session Metrics
- Total conversation sessions
- Average turns per session
- Session duration distribution
- Completion vs abandonment rates

### Conversation Detail
- Per-session trace view
- Turn-by-turn latency analysis
- Token consumption across the conversation
- Context window utilization

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.request.model)` grouped by `trace.id` for session correlation
- Multi-span aggregation for conversation-level metrics
