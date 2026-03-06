// GenAI Control Center — Agentic Framework Detection
// Quick Win #3: Detect and label LangChain, Bedrock Agents, Google ADK, CrewAI, AutoGen
// from span attributes, service names, and tool naming patterns

import { useState, useEffect, useCallback } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';

// ============================================
// Types
// ============================================

export interface AgenticFramework {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;    // emoji for quick display
  description: string;
}

export interface FrameworkDetection {
  framework: AgenticFramework;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  serviceCount: number;
  traceCount: number;
  firstSeen: string;
  lastSeen: string;
}

export interface FrameworkServiceMapping {
  serviceName: string;
  frameworks: string[];
  spanCount: number;
  agentCount: number;
  toolCount: number;
}

// ============================================
// Known Frameworks
// ============================================

export const KNOWN_FRAMEWORKS: Record<string, AgenticFramework> = {
  langchain: {
    id: 'langchain',
    name: 'langchain',
    displayName: 'LangChain',
    color: '#1C3C3C',
    icon: '🦜',
    description: 'LangChain framework for building LLM applications',
  },
  langgraph: {
    id: 'langgraph',
    name: 'langgraph',
    displayName: 'LangGraph',
    color: '#3B82F6',
    icon: '🔗',
    description: 'LangGraph stateful multi-actor agent framework',
  },
  crewai: {
    id: 'crewai',
    name: 'crewai',
    displayName: 'CrewAI',
    color: '#FF6B35',
    icon: '👥',
    description: 'CrewAI multi-agent orchestration framework',
  },
  autogen: {
    id: 'autogen',
    name: 'autogen',
    displayName: 'AutoGen',
    color: '#0078D4',
    icon: '🤖',
    description: 'Microsoft AutoGen multi-agent conversation framework',
  },
  bedrock_agents: {
    id: 'bedrock_agents',
    name: 'bedrock_agents',
    displayName: 'Bedrock Agents',
    color: '#FF9900',
    icon: '☁️',
    description: 'AWS Bedrock Agents managed agent service',
  },
  google_adk: {
    id: 'google_adk',
    name: 'google_adk',
    displayName: 'Google ADK',
    color: '#4285F4',
    icon: '🔵',
    description: 'Google Agent Development Kit',
  },
  semantic_kernel: {
    id: 'semantic_kernel',
    name: 'semantic_kernel',
    displayName: 'Semantic Kernel',
    color: '#512BD4',
    icon: '🧠',
    description: 'Microsoft Semantic Kernel AI orchestration SDK',
  },
  llamaindex: {
    id: 'llamaindex',
    name: 'llamaindex',
    displayName: 'LlamaIndex',
    color: '#8B5CF6',
    icon: '🦙',
    description: 'LlamaIndex data framework for LLM applications',
  },
  openai_agents: {
    id: 'openai_agents',
    name: 'openai_agents',
    displayName: 'OpenAI Agents SDK',
    color: '#10A37F',
    icon: '🟢',
    description: 'OpenAI Agents SDK for building agentic applications',
  },
  haystack: {
    id: 'haystack',
    name: 'haystack',
    displayName: 'Haystack',
    color: '#00C853',
    icon: '🌾',
    description: 'deepset Haystack NLP / LLM pipeline framework',
  },
};

// Detection patterns for each framework
const DETECTION_PATTERNS: Record<string, { spanPatterns: string[]; attributePatterns: string[]; toolPatterns: string[] }> = {
  langchain: {
    spanPatterns: ['langchain', 'LangChain', 'lcel'],
    attributePatterns: ['langchain.run', 'langchain.chain', 'langchain.llm'],
    toolPatterns: ['langchain_tool', 'lc_tool'],
  },
  langgraph: {
    spanPatterns: ['langgraph', 'LangGraph', 'graph_node', 'graph_edge'],
    attributePatterns: ['langgraph.node', 'langgraph.state'],
    toolPatterns: ['graph_tool', 'state_tool'],
  },
  crewai: {
    spanPatterns: ['crewai', 'CrewAI', 'crew_agent', 'crew_task'],
    attributePatterns: ['crewai.agent', 'crewai.task', 'crewai.crew'],
    toolPatterns: ['crew_', 'crewai_tool'],
  },
  autogen: {
    spanPatterns: ['autogen', 'AutoGen', 'assistant_agent', 'user_proxy'],
    attributePatterns: ['autogen.agent', 'autogen.conversation'],
    toolPatterns: ['autogen_tool', 'auto_gen'],
  },
  bedrock_agents: {
    spanPatterns: ['bedrock', 'BedrockAgent', 'bedrock-agent', 'bedrock-runtime'],
    attributePatterns: ['aws.bedrock', 'gen_ai.system:aws.bedrock'],
    toolPatterns: ['bedrock_tool', 'action_group'],
  },
  google_adk: {
    spanPatterns: ['google_adk', 'GoogleADK', 'adk_agent', 'vertex_ai_agent'],
    attributePatterns: ['google_adk.agent', 'vertexai.agent'],
    toolPatterns: ['adk_tool', 'vertex_tool'],
  },
  semantic_kernel: {
    spanPatterns: ['semantic_kernel', 'SemanticKernel', 'sk_function'],
    attributePatterns: ['semantic_kernel.function', 'sk.plugin'],
    toolPatterns: ['sk_tool', 'kernel_function'],
  },
  llamaindex: {
    spanPatterns: ['llamaindex', 'LlamaIndex', 'llama_index'],
    attributePatterns: ['llamaindex.query', 'llamaindex.retriever'],
    toolPatterns: ['llama_tool', 'query_engine'],
  },
  openai_agents: {
    spanPatterns: ['openai_agent', 'swarm', 'function_tool'],
    attributePatterns: ['openai.agent', 'gen_ai.system:openai'],
    toolPatterns: ['openai_tool', 'function_call'],
  },
  haystack: {
    spanPatterns: ['haystack', 'Haystack', 'pipeline_run'],
    attributePatterns: ['haystack.component', 'haystack.pipeline'],
    toolPatterns: ['haystack_tool', 'hs_component'],
  },
};

// ============================================
// DQL Queries for Framework Detection
// ============================================

/** Query span names and attributes to detect frameworks */
const FRAMEWORK_DETECTION_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model) OR span.kind == "INTERNAL"
| fieldsAdd service_name = coalesce(service.name, "Unknown")
| fieldsAdd span_name_lower = toLower(span.name)
| fieldsAdd system = toString(gen_ai.system)
| summarize
    span_count = count(),
    sample_span_names = collectDistinct(span.name, maxLength:20),
    sample_systems = collectDistinct(gen_ai.system, maxLength:10),
    unique_traces = countDistinct(trace_id),
    first = min(start_time),
    last = max(start_time),
    by: { service_name }
`;

/** Query tool names associated with agents */
const AGENT_TOOL_NAMES_QUERY = `
fetch spans, from: now()-24h, to: now()
| filter span.kind == "INTERNAL" OR span.kind == "CLIENT"
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model) OR matchesPhrase(span.name, "tool") OR matchesPhrase(span.name, "agent")
| fieldsAdd tool_name = span.name
| fieldsAdd service_name = coalesce(service.name, "Unknown")
| summarize
    call_count = count(),
    by: { service_name, tool_name }
| sort call_count desc
| limit 200
`;

// ============================================
// Safe DQL executor
// ============================================

async function safeDql(query: string): Promise<any[]> {
  try {
    const response = await queryExecutionClient.queryExecute({
      body: { query, requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
    });
    return response.result?.records || [];
  } catch (err) {
    console.warn('[GCC:FrameworkDetection] DQL error:', err);
    return [];
  }
}

// ============================================
// Hook: useFrameworkDetection
// ============================================

export function useFrameworkDetection() {
  const [detections, setDetections] = useState<FrameworkDetection[]>([]);
  const [serviceMappings, setServiceMappings] = useState<FrameworkServiceMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [serviceRecords, toolRecords] = await Promise.all([
        safeDql(FRAMEWORK_DETECTION_QUERY),
        safeDql(AGENT_TOOL_NAMES_QUERY),
      ]);

      // Build service → span/tool name mapping
      const serviceSpanNames = new Map<string, string[]>();
      const serviceSystems = new Map<string, string[]>();
      const serviceToolNames = new Map<string, string[]>();
      const serviceTraceCount = new Map<string, number>();
      const serviceFirst = new Map<string, string>();
      const serviceLast = new Map<string, string>();

      serviceRecords.forEach((r: any) => {
        const svc = String(r.service_name || 'Unknown');
        serviceSpanNames.set(svc, (r.sample_span_names || []).map(String));
        serviceSystems.set(svc, (r.sample_systems || []).map(String));
        serviceTraceCount.set(svc, Number(r.unique_traces) || 0);
        serviceFirst.set(svc, String(r.first || ''));
        serviceLast.set(svc, String(r.last || ''));
      });

      toolRecords.forEach((r: any) => {
        const svc = String(r.service_name || 'Unknown');
        const tools = serviceToolNames.get(svc) || [];
        tools.push(String(r.tool_name || ''));
        serviceToolNames.set(svc, tools);
      });

      // Detect frameworks for each service
      const frameworkHits = new Map<string, { evidence: string[]; services: Set<string>; traces: number; first: string; last: string }>();
      const svcFrameworks = new Map<string, Set<string>>();

      function checkPatterns(svc: string, names: string[], patterns: string[], frameworkId: string, evidencePrefix: string) {
        for (const name of names) {
          const lower = name.toLowerCase();
          for (const pattern of patterns) {
            if (lower.includes(pattern.toLowerCase())) {
              const hits = frameworkHits.get(frameworkId) || { evidence: [], services: new Set(), traces: 0, first: '', last: '' };
              hits.evidence.push(`${evidencePrefix}: "${name}" matches "${pattern}"`);
              hits.services.add(svc);
              hits.traces += serviceTraceCount.get(svc) || 0;
              if (!hits.first || (serviceFirst.get(svc) || '') < hits.first) hits.first = serviceFirst.get(svc) || '';
              if (!hits.last || (serviceLast.get(svc) || '') > hits.last) hits.last = serviceLast.get(svc) || '';
              frameworkHits.set(frameworkId, hits);

              const svcFw = svcFrameworks.get(svc) || new Set();
              svcFw.add(frameworkId);
              svcFrameworks.set(svc, svcFw);
              return; // One match per pattern set per service
            }
          }
        }
      }

      for (const svc of serviceSpanNames.keys()) {
        const spanNames = serviceSpanNames.get(svc) || [];
        const systems = serviceSystems.get(svc) || [];
        const toolNames = serviceToolNames.get(svc) || [];

        for (const [fwId, patterns] of Object.entries(DETECTION_PATTERNS)) {
          checkPatterns(svc, spanNames, patterns.spanPatterns, fwId, 'Span name');
          checkPatterns(svc, systems, patterns.attributePatterns, fwId, 'System attribute');
          checkPatterns(svc, toolNames, patterns.toolPatterns, fwId, 'Tool name');
        }
      }

      // Build detection results
      const newDetections: FrameworkDetection[] = [];
      frameworkHits.forEach((hits, fwId) => {
        const framework = KNOWN_FRAMEWORKS[fwId];
        if (!framework) return;

        const confidence: FrameworkDetection['confidence'] =
          hits.evidence.length >= 3 ? 'high' :
          hits.evidence.length >= 2 ? 'medium' : 'low';

        newDetections.push({
          framework,
          confidence,
          evidence: hits.evidence.slice(0, 5),
          serviceCount: hits.services.size,
          traceCount: hits.traces,
          firstSeen: hits.first,
          lastSeen: hits.last,
        });
      });

      // Build service mappings
      const newMappings: FrameworkServiceMapping[] = [];
      svcFrameworks.forEach((fws, svc) => {
        const tools = serviceToolNames.get(svc) || [];
        newMappings.push({
          serviceName: svc,
          frameworks: Array.from(fws),
          spanCount: serviceTraceCount.get(svc) || 0,
          agentCount: tools.filter(t => t.toLowerCase().includes('agent')).length,
          toolCount: tools.filter(t => t.toLowerCase().includes('tool')).length,
        });
      });

      setDetections(newDetections.sort((a, b) => b.traceCount - a.traceCount));
      setServiceMappings(newMappings.sort((a, b) => b.spanCount - a.spanCount));
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { detections, serviceMappings, loading, error, refetch };
}
