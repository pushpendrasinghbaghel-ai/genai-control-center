// GenAI Control Center - Rate Card Configuration  
// User-configurable pricing based on their provider contracts

/**
 * Rate Card Entry - matches how providers present pricing:
 * - inputPer1M: Cost per 1 million input (prompt) tokens
 * - outputPer1M: Cost per 1 million output (completion) tokens
 * 
 * Users typically see these rates in their provider invoices/contracts
 */
export interface RateCardEntry {
  model: string;
  provider: string;
  inputPer1M: number;   // $ per 1M input tokens
  outputPer1M: number;  // $ per 1M output tokens
  notes?: string;       // User notes (e.g., "Enterprise discount", "Azure commitment")
  isCustom?: boolean;   // true if user has customized this rate
  lastUpdated?: number; // timestamp
}

/**
 * Provider Rate Card - groups models by provider for easier navigation
 */
export interface ProviderRateCard {
  provider: string;
  displayName: string;
  models: RateCardEntry[];
}

/**
 * User's complete rate card configuration
 */
export interface RateCardConfig {
  version: number;
  lastModified: number;
  customRates: RateCardEntry[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT PRICING - Public list prices as of 2024
// Users can override these with their negotiated/contract rates
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_RATE_CARDS: ProviderRateCard[] = [
  {
    provider: 'openai',
    displayName: 'OpenAI',
    models: [
      { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.50, outputPer1M: 10.00, notes: 'Latest flagship model' },
      { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.60, notes: 'Cost-effective for simple tasks' },
      { provider: 'openai', model: 'gpt-4-turbo', inputPer1M: 10.00, outputPer1M: 30.00, notes: '128K context' },
      { provider: 'openai', model: 'gpt-4', inputPer1M: 30.00, outputPer1M: 60.00, notes: 'Original GPT-4' },
      { provider: 'openai', model: 'gpt-3.5-turbo', inputPer1M: 0.50, outputPer1M: 1.50, notes: 'Legacy, still widely used' },
      { provider: 'openai', model: 'text-embedding-3-small', inputPer1M: 0.02, outputPer1M: 0, notes: 'Embeddings only' },
      { provider: 'openai', model: 'text-embedding-3-large', inputPer1M: 0.13, outputPer1M: 0, notes: 'High-dim embeddings' },
      { provider: 'openai', model: 'text-embedding-ada-002', inputPer1M: 0.10, outputPer1M: 0, notes: 'Legacy embeddings' },
    ]
  },
  {
    provider: 'azure_openai',
    displayName: 'Azure OpenAI',
    models: [
      { provider: 'azure_openai', model: 'gpt-4o', inputPer1M: 2.50, outputPer1M: 10.00, notes: 'Same as OpenAI list price' },
      { provider: 'azure_openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.60, notes: 'Same as OpenAI list price' },
      { provider: 'azure_openai', model: 'gpt-4-turbo', inputPer1M: 10.00, outputPer1M: 30.00, notes: 'Same as OpenAI list price' },
      { provider: 'azure_openai', model: 'gpt-4', inputPer1M: 30.00, outputPer1M: 60.00, notes: 'Same as OpenAI list price' },
      { provider: 'azure_openai', model: 'gpt-35-turbo', inputPer1M: 0.50, outputPer1M: 1.50, notes: 'Azure naming convention' },
    ]
  },
  {
    provider: 'anthropic',
    displayName: 'Anthropic',
    models: [
      { provider: 'anthropic', model: 'claude-3-opus', inputPer1M: 15.00, outputPer1M: 75.00, notes: 'Most capable Claude' },
      { provider: 'anthropic', model: 'claude-3.5-sonnet', inputPer1M: 3.00, outputPer1M: 15.00, notes: 'Best value for complex tasks' },
      { provider: 'anthropic', model: 'claude-3-sonnet', inputPer1M: 3.00, outputPer1M: 15.00, notes: 'Balanced performance' },
      { provider: 'anthropic', model: 'claude-3-haiku', inputPer1M: 0.25, outputPer1M: 1.25, notes: 'Fastest, most affordable' },
      { provider: 'anthropic', model: 'claude-2.1', inputPer1M: 8.00, outputPer1M: 24.00, notes: 'Legacy model' },
    ]
  },
  {
    provider: 'google',
    displayName: 'Google (Vertex AI)',
    models: [
      { provider: 'google', model: 'gemini-1.5-pro', inputPer1M: 3.50, outputPer1M: 10.50, notes: '1M context window' },
      { provider: 'google', model: 'gemini-1.5-flash', inputPer1M: 0.075, outputPer1M: 0.30, notes: 'Fast & cheap' },
      { provider: 'google', model: 'gemini-pro', inputPer1M: 0.50, outputPer1M: 1.50, notes: 'Standard Gemini' },
      { provider: 'google', model: 'text-embedding-004', inputPer1M: 0.025, outputPer1M: 0, notes: 'Latest embeddings' },
      { provider: 'google', model: 'textembedding-gecko', inputPer1M: 0.025, outputPer1M: 0, notes: 'Legacy embeddings' },
    ]
  },
  {
    provider: 'amazon_bedrock',
    displayName: 'Amazon Bedrock',
    models: [
      { provider: 'amazon_bedrock', model: 'anthropic.claude-3-opus', inputPer1M: 15.00, outputPer1M: 75.00, notes: 'Via Bedrock' },
      { provider: 'amazon_bedrock', model: 'anthropic.claude-3-sonnet', inputPer1M: 3.00, outputPer1M: 15.00, notes: 'Via Bedrock' },
      { provider: 'amazon_bedrock', model: 'anthropic.claude-3-haiku', inputPer1M: 0.25, outputPer1M: 1.25, notes: 'Via Bedrock' },
      { provider: 'amazon_bedrock', model: 'amazon.titan-text-express', inputPer1M: 0.20, outputPer1M: 0.60, notes: 'AWS native' },
      { provider: 'amazon_bedrock', model: 'amazon.titan-embed-text', inputPer1M: 0.02, outputPer1M: 0, notes: 'Embeddings' },
      { provider: 'amazon_bedrock', model: 'meta.llama3-70b-instruct', inputPer1M: 2.65, outputPer1M: 3.50, notes: 'Llama 3 via Bedrock' },
      { provider: 'amazon_bedrock', model: 'cohere.command-r-plus', inputPer1M: 3.00, outputPer1M: 15.00, notes: 'Command R+ via Bedrock' },
    ]
  },
  {
    provider: 'cohere',
    displayName: 'Cohere',
    models: [
      { provider: 'cohere', model: 'command-r-plus', inputPer1M: 3.00, outputPer1M: 15.00, notes: 'Enterprise RAG optimized' },
      { provider: 'cohere', model: 'command-r', inputPer1M: 0.50, outputPer1M: 1.50, notes: 'Efficient & accurate' },
      { provider: 'cohere', model: 'embed-english-v3', inputPer1M: 0.10, outputPer1M: 0, notes: 'English embeddings' },
      { provider: 'cohere', model: 'embed-multilingual-v3', inputPer1M: 0.10, outputPer1M: 0, notes: '100+ languages' },
    ]
  },
  {
    provider: 'ollama',
    displayName: 'Ollama (Local)',
    models: [
      { provider: 'ollama', model: 'llama3', inputPer1M: 0, outputPer1M: 0, notes: 'Self-hosted, no API cost' },
      { provider: 'ollama', model: 'mistral', inputPer1M: 0, outputPer1M: 0, notes: 'Self-hosted, no API cost' },
      { provider: 'ollama', model: 'codellama', inputPer1M: 0, outputPer1M: 0, notes: 'Self-hosted, no API cost' },
      { provider: 'ollama', model: 'deepseek-coder', inputPer1M: 0, outputPer1M: 0, notes: 'Self-hosted, no API cost' },
    ]
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS (FALLBACK)
// Primary storage is now Dynatrace Document storage (Grail) via useRateCardStorage hook
// These localStorage functions are kept as fallback for offline/development scenarios
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'gcc_rate_card_config';

/**
 * Load user's custom rate card configuration from localStorage
 */
export function loadRateCardConfig(): RateCardConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as RateCardConfig;
    }
  } catch (e) {
    console.warn('Failed to load rate card config:', e);
  }
  return { version: 1, lastModified: Date.now(), customRates: [] };
}

/**
 * Save user's custom rate card configuration to localStorage
 */
export function saveRateCardConfig(config: RateCardConfig): void {
  try {
    config.lastModified = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save rate card config:', e);
  }
}

/**
 * Add or update a custom rate in the configuration
 */
export function upsertCustomRate(config: RateCardConfig, rate: RateCardEntry): RateCardConfig {
  const existing = config.customRates.findIndex(
    r => r.provider.toLowerCase() === rate.provider.toLowerCase() && 
         r.model.toLowerCase() === rate.model.toLowerCase()
  );
  
  const newRate = { ...rate, isCustom: true, lastUpdated: Date.now() };
  
  if (existing >= 0) {
    config.customRates[existing] = newRate;
  } else {
    config.customRates.push(newRate);
  }
  
  return { ...config };
}

/**
 * Remove a custom rate (revert to default)
 */
export function removeCustomRate(config: RateCardConfig, provider: string, model: string): RateCardConfig {
  return {
    ...config,
    customRates: config.customRates.filter(
      r => !(r.provider.toLowerCase() === provider.toLowerCase() && 
             r.model.toLowerCase() === model.toLowerCase())
    )
  };
}

/**
 * Get the effective rate for a provider/model combination
 * Returns custom rate if exists, otherwise finds best matching default
 */
export function getEffectiveRate(
  config: RateCardConfig,
  provider: string,
  model: string
): RateCardEntry {
  const providerLower = provider?.toLowerCase()?.trim() || '';
  const modelLower = model?.toLowerCase()?.trim() || '';
  
  // 1. Check for exact custom rate match
  const customRate = config.customRates.find(
    r => r.provider.toLowerCase() === providerLower && 
         r.model.toLowerCase() === modelLower
  );
  if (customRate) return customRate;
  
  // 2. Check for custom rate with model substring match
  const customModelMatch = config.customRates.find(
    r => r.provider.toLowerCase() === providerLower && 
         modelLower.includes(r.model.toLowerCase())
  );
  if (customModelMatch) return customModelMatch;
  
  // 3. Find in default rates
  for (const providerCard of DEFAULT_RATE_CARDS) {
    if (providerLower.includes(providerCard.provider) || providerCard.provider.includes(providerLower)) {
      // Try exact model match first
      const exactMatch = providerCard.models.find(m => m.model.toLowerCase() === modelLower);
      if (exactMatch) return exactMatch;
      
      // Try substring match (e.g., "gpt-4o-2024-08-06" matches "gpt-4o")
      const substringMatch = providerCard.models.find(m => modelLower.includes(m.model.toLowerCase()));
      if (substringMatch) return substringMatch;
      
      // Try reverse substring (e.g., model="gpt" matches "gpt-4o")
      const reverseMatch = providerCard.models.find(m => m.model.toLowerCase().includes(modelLower));
      if (reverseMatch) return reverseMatch;
    }
  }
  
  // 4. Fallback: Try matching just the model name across all providers
  for (const providerCard of DEFAULT_RATE_CARDS) {
    const anyMatch = providerCard.models.find(m => 
      modelLower.includes(m.model.toLowerCase()) || m.model.toLowerCase().includes(modelLower)
    );
    if (anyMatch) return anyMatch;
  }
  
  // 5. Ultimate fallback
  return {
    provider: provider || 'unknown',
    model: model || 'unknown',
    inputPer1M: 5.00,  // Conservative default
    outputPer1M: 15.00,
    notes: 'Default fallback rate'
  };
}

/**
 * Calculate cost from rate card entry
 */
export function calculateCostFromRate(
  rate: RateCardEntry,
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * rate.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * rate.outputPer1M;
  return inputCost + outputCost;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT/IMPORT FOR SHARING RATE CARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export rate card config as JSON string (for download/sharing)
 */
export function exportRateCardConfig(config: RateCardConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import rate card config from JSON string
 */
export function importRateCardConfig(json: string): RateCardConfig | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed.customRates && Array.isArray(parsed.customRates)) {
      return {
        version: parsed.version || 1,
        lastModified: Date.now(),
        customRates: parsed.customRates
      };
    }
  } catch (e) {
    console.error('Failed to parse rate card JSON:', e);
  }
  return null;
}

/**
 * Get all models (defaults + custom) for display in settings
 */
export function getAllModelsForDisplay(config: RateCardConfig): ProviderRateCard[] {
  // Start with defaults
  const result = DEFAULT_RATE_CARDS.map(pc => ({
    ...pc,
    models: pc.models.map(m => {
      // Check if there's a custom override
      const custom = config.customRates.find(
        c => c.provider.toLowerCase() === m.provider.toLowerCase() &&
             c.model.toLowerCase() === m.model.toLowerCase()
      );
      return custom ? { ...m, ...custom, isCustom: true } : m;
    })
  }));
  
  // Add any custom models that don't exist in defaults
  config.customRates.forEach(customRate => {
    const providerExists = result.find(
      pc => pc.provider.toLowerCase() === customRate.provider.toLowerCase()
    );
    
    if (providerExists) {
      const modelExists = providerExists.models.find(
        m => m.model.toLowerCase() === customRate.model.toLowerCase()
      );
      if (!modelExists) {
        providerExists.models.push({ ...customRate, isCustom: true });
      }
    } else {
      // New provider
      result.push({
        provider: customRate.provider.toLowerCase(),
        displayName: customRate.provider,
        models: [{ ...customRate, isCustom: true }]
      });
    }
  });
  
  return result;
}
