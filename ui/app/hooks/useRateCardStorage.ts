// GenAI Control Center - Rate Card Storage Hook
// Stores rate card configuration in Dynatrace Document storage (Grail)

import { useState, useCallback, useEffect } from 'react';
import { documentsClient } from '@dynatrace-sdk/client-document';
import type { RateCardConfig, RateCardEntry } from '../config/rate-card-config';
import { DEFAULT_RATE_CARDS } from '../config/rate-card-config';

// Document configuration
const DOCUMENT_NAME = 'gcc-rate-card-config';
const DOCUMENT_TYPE = 'gcc-config';

// Default empty config
const DEFAULT_CONFIG: RateCardConfig = {
  version: 1,
  lastModified: Date.now(),
  customRates: [],
};

interface UseRateCardStorageReturn {
  config: RateCardConfig;
  loading: boolean;
  error: string | null;
  saveConfig: (config: RateCardConfig) => Promise<boolean>;
  upsertRate: (rate: RateCardEntry) => Promise<boolean>;
  removeRate: (provider: string, model: string) => Promise<boolean>;
  resetAll: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing rate card configuration storage in Dynatrace Documents (Grail)
 * 
 * Benefits over localStorage:
 * - Persists across browsers/devices for the same tenant
 * - Shared across team members
 * - Auditable via Grail
 * - Backed up with Dynatrace infrastructure
 */
export function useRateCardStorage(): UseRateCardStorageReturn {
  const [config, setConfig] = useState<RateCardConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentVersion, setDocumentVersion] = useState<string>('');

  // Load config from Grail document storage
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // List documents to find our rate card config
      const response = await documentsClient.listDocuments({
        filter: `name == '${DOCUMENT_NAME}' and type == '${DOCUMENT_TYPE}'`,
      });

      if (response.documents && response.documents.length > 0) {
        // Found existing document - fetch its content
        const doc = response.documents[0];
        setDocumentId(doc.id);
        setDocumentVersion(doc.version || '');
        
        const docResponse = await documentsClient.getDocument({
          id: doc.id,
        });
        
        // Parse the document content - content may be string or needs decoding
        if (docResponse.content) {
          let contentStr: string;
          if (typeof docResponse.content === 'string') {
            contentStr = docResponse.content;
          } else if (docResponse.content instanceof Blob) {
            contentStr = await docResponse.content.text();
          } else {
            // Handle Binary/ArrayBuffer - cast through unknown first
            const decoder = new TextDecoder('utf-8');
            contentStr = decoder.decode(docResponse.content as unknown as ArrayBuffer);
          }
          const parsed = JSON.parse(contentStr) as RateCardConfig;
          setConfig(parsed);
        }
      } else {
        // No existing document - use default config
        setConfig(DEFAULT_CONFIG);
        setDocumentId(null);
        setDocumentVersion('');
      }
    } catch (err) {
      console.warn('Rate card Grail load failed, using defaults:', err);
      // Silently fall back to default config — this is expected on first run
      // or when the document service is unavailable during local dev
      setConfig(DEFAULT_CONFIG);
      setDocumentId(null);
      setDocumentVersion('');
    } finally {
      setLoading(false);
    }
  }, []);

  // Save config to Grail document storage
  const saveConfig = useCallback(async (newConfig: RateCardConfig): Promise<boolean> => {
    try {
      const configToSave: RateCardConfig = {
        ...newConfig,
        lastModified: Date.now(),
      };

      const contentStr = JSON.stringify(configToSave, null, 2);
      // Convert string to Blob for the document API
      const contentBlob = new Blob([contentStr], { type: 'application/json' });

      if (documentId && documentVersion) {
        // Update existing document
        const updateResponse = await documentsClient.updateDocument({
          id: documentId,
          optimisticLockingVersion: documentVersion,
          body: {
            name: DOCUMENT_NAME,
            type: DOCUMENT_TYPE,
            content: contentBlob,
            isPrivate: false, // Share across tenant for team visibility
          },
        });
        // Re-fetch to get updated version
        await loadConfig();
      } else {
        // Create new document
        const createResponse = await documentsClient.createDocument({
          body: {
            name: DOCUMENT_NAME,
            type: DOCUMENT_TYPE,
            content: contentBlob,
          },
        });
        setDocumentId(createResponse.id);
        setDocumentVersion(createResponse.version || '');
      }

      setConfig(configToSave);
      setError(null);
      return true;
    } catch (err) {
      console.error('Failed to save rate card config to Grail:', err);
      setError('Failed to save rate card configuration');
      return false;
    }
  }, [documentId, documentVersion, loadConfig]);

  // Upsert a single rate
  const upsertRate = useCallback(async (rate: RateCardEntry): Promise<boolean> => {
    const existingIndex = config.customRates.findIndex(
      r => r.provider.toLowerCase() === rate.provider.toLowerCase() && 
           r.model.toLowerCase() === rate.model.toLowerCase()
    );

    const newCustomRates = [...config.customRates];
    const rateWithCustomFlag = { ...rate, isCustom: true };

    if (existingIndex >= 0) {
      newCustomRates[existingIndex] = rateWithCustomFlag;
    } else {
      newCustomRates.push(rateWithCustomFlag);
    }

    return saveConfig({ ...config, customRates: newCustomRates });
  }, [config, saveConfig]);

  // Remove a custom rate
  const removeRate = useCallback(async (provider: string, model: string): Promise<boolean> => {
    const newCustomRates = config.customRates.filter(
      r => !(r.provider.toLowerCase() === provider.toLowerCase() && 
             r.model.toLowerCase() === model.toLowerCase())
    );

    return saveConfig({ ...config, customRates: newCustomRates });
  }, [config, saveConfig]);

  // Reset all custom rates
  const resetAll = useCallback(async (): Promise<boolean> => {
    return saveConfig(DEFAULT_CONFIG);
  }, [saveConfig]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    error,
    saveConfig,
    upsertRate,
    removeRate,
    resetAll,
    refetch: loadConfig,
  };
}

/**
 * Get the effective rate for a model, checking custom rates first, then defaults
 */
export function getEffectiveRateFromConfig(
  config: RateCardConfig, 
  provider: string, 
  model: string
): RateCardEntry | null {
  // Check custom rates first
  const customRate = config.customRates.find(
    r => r.provider.toLowerCase() === provider.toLowerCase() && 
         r.model.toLowerCase() === model.toLowerCase()
  );
  if (customRate) return customRate;

  // Fall back to defaults
  const defaultProvider = DEFAULT_RATE_CARDS.find(
    p => p.provider.toLowerCase() === provider.toLowerCase()
  );
  if (defaultProvider) {
    const defaultRate = defaultProvider.models.find(
      m => m.model.toLowerCase() === model.toLowerCase()
    );
    if (defaultRate) return defaultRate;
  }

  return null;
}

/**
 * Calculate cost using rate card config
 */
export function calculateCostFromConfig(
  config: RateCardConfig,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rate = getEffectiveRateFromConfig(config, provider, model);
  
  if (rate) {
    const inputCost = (inputTokens / 1_000_000) * rate.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * rate.outputPer1M;
    return inputCost + outputCost;
  }

  // Fallback to generic estimation if no rate found
  // Use conservative defaults
  const fallbackInputRate = 2.50;  // $/1M tokens
  const fallbackOutputRate = 10.00; // $/1M tokens
  return (inputTokens / 1_000_000) * fallbackInputRate + 
         (outputTokens / 1_000_000) * fallbackOutputRate;
}
