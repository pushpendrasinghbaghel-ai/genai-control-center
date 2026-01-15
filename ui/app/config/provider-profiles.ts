// GenAI Control Center - Provider Profiles Configuration
// Centralized configuration for AI provider risk profiles and certifications
// Last updated: January 2026 - Review quarterly for accuracy

/**
 * Provider compliance and risk profile data
 * NOTE: This is reference data based on publicly available information.
 * Always verify with your specific provider agreements.
 */
export interface ProviderProfile {
  name: string;
  displayName: string;
  baseRiskScore: number; // 0-100, lower is better
  dataResidency: string;
  certifications: string[];
  defaultRiskFactors: string[];
  documentationUrl?: string;
  lastVerified: string; // ISO date when this was last verified
}

export const PROVIDER_PROFILES: Record<string, ProviderProfile> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    baseRiskScore: 35,
    dataResidency: 'United States',
    certifications: ['SOC 2 Type II', 'GDPR DPA', 'CCPA'],
    defaultRiskFactors: ['US-based data processing'],
    documentationUrl: 'https://openai.com/security',
    lastVerified: '2026-01-15',
  },
  azure: {
    name: 'azure',
    displayName: 'Azure OpenAI',
    baseRiskScore: 25,
    dataResidency: 'Configurable (EU, US, Asia available)',
    certifications: ['SOC 2 Type II', 'ISO 27001', 'ISO 27017', 'ISO 27018', 'GDPR', 'HIPAA', 'FedRAMP High'],
    defaultRiskFactors: [],
    documentationUrl: 'https://azure.microsoft.com/en-us/explore/trusted-cloud',
    lastVerified: '2026-01-15',
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    baseRiskScore: 35,
    dataResidency: 'United States',
    certifications: ['SOC 2 Type II', 'HIPAA BAA'],
    defaultRiskFactors: ['Limited compliance certifications'],
    documentationUrl: 'https://www.anthropic.com/security',
    lastVerified: '2026-01-15',
  },
  google: {
    name: 'google',
    displayName: 'Google AI (Gemini)',
    baseRiskScore: 25,
    dataResidency: 'Configurable (Multi-region)',
    certifications: ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'HIPAA', 'FedRAMP'],
    defaultRiskFactors: [],
    documentationUrl: 'https://cloud.google.com/security/compliance',
    lastVerified: '2026-01-15',
  },
  vertexai: {
    name: 'vertexai',
    displayName: 'Google Vertex AI',
    baseRiskScore: 25,
    dataResidency: 'Configurable (Multi-region)',
    certifications: ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'HIPAA', 'FedRAMP'],
    defaultRiskFactors: [],
    documentationUrl: 'https://cloud.google.com/vertex-ai/docs/general/security',
    lastVerified: '2026-01-15',
  },
  amazon: {
    name: 'amazon',
    displayName: 'Amazon Bedrock',
    baseRiskScore: 20,
    dataResidency: 'Configurable (Multi-region)',
    certifications: ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'HIPAA', 'FedRAMP High', 'PCI DSS'],
    defaultRiskFactors: [],
    documentationUrl: 'https://aws.amazon.com/compliance/',
    lastVerified: '2026-01-15',
  },
  ollama: {
    name: 'ollama',
    displayName: 'Ollama (Self-hosted)',
    baseRiskScore: 15,
    dataResidency: 'On-premises / Self-managed',
    certifications: ['Self-managed - depends on your infrastructure'],
    defaultRiskFactors: ['Requires self-managed security', 'No vendor SLA'],
    documentationUrl: 'https://ollama.ai/',
    lastVerified: '2026-01-15',
  },
  langchain: {
    name: 'langchain',
    displayName: 'LangChain',
    baseRiskScore: 30,
    dataResidency: 'Depends on underlying provider',
    certifications: ['SOC 2 Type II (LangSmith)'],
    defaultRiskFactors: ['Framework - security depends on underlying providers'],
    documentationUrl: 'https://www.langchain.com/',
    lastVerified: '2026-01-15',
  },
};

/**
 * Get provider profile by name (case-insensitive)
 */
export const getProviderProfile = (providerName: string): ProviderProfile => {
  const normalized = providerName?.toLowerCase()?.trim() || '';
  return PROVIDER_PROFILES[normalized] || {
    name: normalized || 'unknown',
    displayName: providerName || 'Unknown Provider',
    baseRiskScore: 50,
    dataResidency: 'Unknown',
    certifications: [],
    defaultRiskFactors: ['Unknown provider - risk profile not available'],
    lastVerified: 'N/A',
  };
};

/**
 * Enterprise AI Governance Challenges
 * These are common governance scenarios - customize based on your organization
 */
export interface GovernanceChallengeTemplate {
  id: string;
  category: string;
  challenge: string;
  impact: string;
  mitigation: string;
  defaultStatus: 'detected' | 'monitoring' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
}

export const GOVERNANCE_CHALLENGES: GovernanceChallengeTemplate[] = [
  {
    id: 'gc1',
    category: 'Data Sovereignty',
    challenge: 'Cross-Border Data Transfers',
    impact: 'Customer data sent to US-based AI providers may violate GDPR Article 44-49 transfer restrictions',
    mitigation: 'Use EU-hosted provider endpoints (Azure EU, AWS Frankfurt) or deploy on-premises models',
    defaultStatus: 'monitoring',
    severity: 'high',
    tags: ['GDPR', 'data-privacy', 'compliance'],
  },
  {
    id: 'gc2',
    category: 'Shadow AI',
    challenge: 'Unmonitored AI Tool Usage',
    impact: 'Employees using personal ChatGPT accounts with company data bypasses security controls',
    mitigation: 'Deploy enterprise AI gateway with SSO, implement DLP policies, provide approved alternatives',
    defaultStatus: 'detected',
    severity: 'critical',
    tags: ['security', 'data-leakage', 'DLP'],
  },
  {
    id: 'gc3',
    category: 'Model Governance',
    challenge: 'Model Drift & Version Control',
    impact: 'Provider model updates may change behavior, affecting accuracy and compliance',
    mitigation: 'Pin model versions, implement A/B testing for updates, maintain baseline evaluations',
    defaultStatus: 'monitoring',
    severity: 'medium',
    tags: ['MLOps', 'version-control', 'testing'],
  },
  {
    id: 'gc4',
    category: 'Security',
    challenge: 'Prompt Injection Attacks',
    impact: 'Malicious inputs may manipulate AI responses, leak system prompts, or bypass guardrails',
    mitigation: 'Input sanitization, prompt templates, output validation, rate limiting suspicious patterns',
    defaultStatus: 'detected',
    severity: 'critical',
    tags: ['security', 'adversarial', 'input-validation'],
  },
  {
    id: 'gc5',
    category: 'Fairness & Ethics',
    challenge: 'AI Output Bias',
    impact: 'Model responses may discriminate based on protected characteristics in HR, lending, healthcare',
    mitigation: 'Bias testing frameworks, human review for high-stakes decisions, diverse training data audits',
    defaultStatus: 'monitoring',
    severity: 'high',
    tags: ['ethics', 'fairness', 'bias', 'EU-AI-Act'],
  },
  {
    id: 'gc6',
    category: 'Compliance',
    challenge: 'Audit Trail Completeness',
    impact: 'Incomplete logging of prompts/responses makes incident investigation and compliance audits difficult',
    mitigation: 'Enable gen_ai.* OpenTelemetry attributes, centralize logs in Grail, implement retention policies',
    defaultStatus: 'monitoring',
    severity: 'medium',
    tags: ['audit', 'logging', 'observability'],
  },
  {
    id: 'gc7',
    category: 'Cost Management',
    challenge: 'Cost Attribution to Business Units',
    impact: 'Cannot accurately charge back AI costs to departments, leading to budget overruns',
    mitigation: 'Tag all requests with cost center, implement showback dashboards, set per-team quotas',
    defaultStatus: 'resolved',
    severity: 'low',
    tags: ['FinOps', 'cost', 'chargeback'],
  },
  {
    id: 'gc8',
    category: 'Data Privacy',
    challenge: 'Training Data Exposure',
    impact: 'Customer data used in prompts may be retained by providers for model training',
    mitigation: 'Opt-out of training data programs, use zero-retention APIs, anonymize sensitive fields',
    defaultStatus: 'monitoring',
    severity: 'high',
    tags: ['privacy', 'data-retention', 'PII'],
  },
  {
    id: 'gc9',
    category: 'Vendor Risk',
    challenge: 'Single Provider Dependency',
    impact: 'Over-reliance on one AI provider creates availability and pricing risks',
    mitigation: 'Multi-provider strategy, abstract AI calls through gateway layer, maintain fallback providers',
    defaultStatus: 'monitoring',
    severity: 'medium',
    tags: ['vendor-risk', 'resilience', 'multi-cloud'],
  },
  {
    id: 'gc10',
    category: 'Legal',
    challenge: 'Intellectual Property Contamination',
    impact: 'AI-generated code/content may include copyrighted material, creating legal liability',
    mitigation: 'Use models with indemnification, implement code scanning, document AI usage in IP policies',
    defaultStatus: 'monitoring',
    severity: 'medium',
    tags: ['legal', 'IP', 'copyright'],
  },
];

/**
 * Best Practices for Enterprise AI Governance
 */
export const GOVERNANCE_BEST_PRACTICES = [
  'Establish an AI Center of Excellence with cross-functional governance board',
  'Implement AI gateway layer for centralized control, logging, and policy enforcement',
  'Deploy PII detection and masking before data leaves your network',
  'Use semantic caching to reduce costs and latency for repetitive queries',
  'Maintain model inventory with version tracking and deprecation alerts',
  'Implement output validation and human-in-the-loop for high-stakes decisions',
  'Regular bias audits and fairness testing for customer-facing AI',
  'Document AI usage in privacy policies and obtain appropriate consent',
];
