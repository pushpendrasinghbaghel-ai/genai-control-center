---
layout: default
title: RAG & Vector DB
parent: Observe
---

# RAG & Vector DB Observability

**Route**: `/vector-db`  
**Persona**: ML Engineer, Platform Engineer

## Use Cases

- **RAG pipeline monitoring**: Track retrieval quality, embedding latency, and vector store health
- **Semantic cache optimization**: Identify cache-able queries to reduce cost and latency
- **Embedding performance**: Monitor embedding generation throughput and error rates

## Features

### Pipeline Funnel
Visual funnel showing the RAG pipeline stages:
1. Embedding generation → 2. Vector search → 3. Context retrieval → 4. LLM completion

Drop-off rates between stages highlight bottlenecks.

### Vector Store Metrics
- Query volume and latency by store (Pinecone, Weaviate, Chroma, etc.)
- Top-K distribution
- Result count trends

### Embedding Analytics
- Embedding model comparison (dimensions, latency, cost)
- Batch vs single embedding performance
- Token-per-embedding efficiency

### Latency Histogram
Distribution of RAG query latencies with P50/P95/P99 markers.

### Cost by Model
Per-model cost breakdown for embedding and completion models in RAG pipelines.

## Supported Vector Stores

- Pinecone
- Weaviate
- Chroma
- Milvus
- Qdrant
- pgvector

## Data Sources

- `fetch spans | filter db.system == "pinecone" OR ...` — Vector DB operations
- `fetch spans | filter gen_ai.request.model contains "embedding"` — Embedding spans
