---
layout: default
title: Developer Experience
parent: Observe
---

# Developer Experience

**Route**: `/devex`  
**Persona**: ML Engineer, Platform Engineer

## Use Cases

- **Instrumentation coverage**: Assess how well AI services are instrumented
- **Shadow AI detection**: Find uninstrumented or unauthorized AI usage
- **Code attribution**: Track which codebases generate the most AI traffic

## Features

### Coverage Dashboard
- Percentage of services with full gen_ai.* instrumentation
- Missing attribute detection (e.g., no prompt content, no token counts)
- Instrumentation recommendations

### Shadow AI Detection
- Services making AI calls without proper gen_ai.* attributes
- Unauthorized provider usage
- Unregistered model detection

### Code Attribution
- Service-level attribution by deployment tags
- Git commit correlation (when available)
- Team ownership mapping

## Data Sources

- `fetch spans | filter isNotNull(gen_ai.request.model)` — Instrumented services
- `fetch spans | filter span.kind == "CLIENT"` — Potential uninstrumented AI calls
