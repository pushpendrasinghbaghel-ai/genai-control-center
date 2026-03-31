// GenAI Control Center - Rate Card Settings Component
// User-configurable pricing based on their provider contracts
// Storage: Dynatrace Document storage (Grail) for tenant-wide persistence

import React, { useState, useCallback, useMemo } from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';
import { Heading, Text, Strong } from '@dynatrace/strato-components/typography';
import { Button } from '@dynatrace/strato-components/buttons';
import { TextInput, NumberInput, Select } from '@dynatrace/strato-components/forms';
import { Modal } from '@dynatrace/strato-components/overlays';
import { Tabs, Tab } from '@dynatrace/strato-components/navigation';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { MoneyIcon, RefreshIcon, HelpIcon, DocumentIcon, EditIcon, CheckmarkIcon, CriticalIcon, UploadIcon, DownloadIcon, PlusIcon, DatabaseIcon } from '@dynatrace/strato-icons';
import { Colors } from '@dynatrace/strato-design-tokens';
import {
  DEFAULT_RATE_CARDS,
  getAllModelsForDisplay,
  exportRateCardConfig,
  importRateCardConfig,
  type RateCardConfig,
  type RateCardEntry,
  type ProviderRateCard,
} from '../config/rate-card-config';
import { useRateCardStorage } from '../hooks/useRateCardStorage';

interface DetectedModel {
  model: string;
  provider: string;
}

interface RateCardSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (config: RateCardConfig) => void;
  /** Models detected from actual environment usage (via DQL span data) */
  detectedModels?: DetectedModel[];
}

/**
 * Rate Card Settings Component
 * 
 * Allows users to customize AI model pricing based on their provider contracts.
 * Features:
 * - View all default (public) pricing
 * - Override with custom/negotiated rates
 * - Add new models not in the default list
 * - Export/Import configurations
 * - Reset to defaults
 */
export function RateCardSettings({ isOpen, onClose, onConfigChange, detectedModels }: RateCardSettingsProps) {
  // Use Grail document storage for rate cards
  const { 
    config, 
    loading, 
    error, 
    saveConfig, 
    upsertRate, 
    removeRate, 
    resetAll, 
    refetch 
  } = useRateCardStorage();
  
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<RateCardEntry | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Get all models with custom overrides applied
  const displayData = useMemo(() => getAllModelsForDisplay(config), [config]);

  // Find models detected in environment that don't have rate cards configured
  const unconfiguredModels = useMemo(() => {
    if (!detectedModels || detectedModels.length === 0) return [];
    
    // Create a Set of configured model keys for fast lookup
    const configuredKeys = new Set<string>();
    displayData.forEach(providerCard => {
      providerCard.models.forEach(model => {
        configuredKeys.add(`${model.provider.toLowerCase()}:${model.model.toLowerCase()}`);
      });
    });
    
    // Filter to only models not in config
    return detectedModels.filter(dm => {
      const key = `${dm.provider.toLowerCase()}:${dm.model.toLowerCase()}`;
      return !configuredKeys.has(key);
    });
  }, [detectedModels, displayData]);

  // Handle rate update (async - saves to Grail)
  const handleUpdateRate = useCallback(async (rate: RateCardEntry) => {
    setSaving(true);
    const success = await upsertRate(rate);
    setSaving(false);
    
    if (success) {
      setEditingModel(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onConfigChange?.(config);
    }
  }, [upsertRate, config, onConfigChange]);

  // Handle reset to default (async - saves to Grail)
  const handleResetToDefault = useCallback(async (provider: string, model: string) => {
    setSaving(true);
    const success = await removeRate(provider, model);
    setSaving(false);
    
    if (success) {
      onConfigChange?.(config);
    }
  }, [removeRate, config, onConfigChange]);

  // Handle reset all (async - saves to Grail)
  const handleResetAll = useCallback(async () => {
    setSaving(true);
    const success = await resetAll();
    setSaving(false);
    
    if (success) {
      onConfigChange?.(config);
    }
  }, [resetAll, config, onConfigChange]);

  // Handle export
  const handleExport = useCallback(() => {
    const json = exportRateCardConfig(config);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcc-rate-card-config.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  // Handle import (async - saves to Grail)
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const imported = importRateCardConfig(content);
      if (imported) {
        setSaving(true);
        const success = await saveConfig(imported);
        setSaving(false);
        
        if (success) {
          setImportError(null);
          onConfigChange?.(imported);
        } else {
          setImportError('Failed to save imported configuration to Grail');
        }
      } else {
        setImportError('Invalid rate card file format');
      }
    };
    reader.readAsText(file);
  }, [saveConfig, onConfigChange]);

  // Count custom rates
  const customCount = config.customRates.length;

  return (
    <Modal
      title="Rate Card Settings"
      show={isOpen}
      onDismiss={onClose}
      size="large"
    >
      <Flex flexDirection="column" gap={16} style={{ padding: 8, minHeight: 500 }}>
        {/* Loading Overlay */}
        {(loading || saving) && (
          <Surface style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(255, 255, 255, 0.8)', 
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Flex flexDirection="column" alignItems="center" gap={12}>
              <ProgressCircle />
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                {loading ? 'Loading from Grail...' : 'Saving to Grail...'}
              </Text>
            </Flex>
          </Surface>
        )}

        {/* Error Display */}
        {error && (
          <Surface style={{ padding: 12, backgroundColor: 'rgba(255, 77, 77, 0.1)', borderRadius: 4 }}>
            <Flex alignItems="center" gap={8}>
              <CriticalIcon style={{ width: 16, height: 16, color: Colors.Text.Critical.Default }} />
              <Text style={{ color: Colors.Text.Critical.Default }}>{error}</Text>
              <Button variant="default" onClick={refetch}>
                <RefreshIcon /> Retry
              </Button>
            </Flex>
          </Surface>
        )}

        {/* Header Info */}
        <Surface style={{ padding: 12, background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 8 }}>
          <Flex alignItems="flex-start" gap={12}>
            <MoneyIcon style={{ width: 24, height: 24, color: Colors.Charts.Apdex.Good.Default, flexShrink: 0, marginTop: 2 }} />
            <Flex flexDirection="column" gap={4}>
              <Flex alignItems="center" gap={8}>
                <Heading level={6} style={{ margin: 0 }}>Customize Your AI Cost Rates</Heading>
                <Tooltip text="Rate cards are stored in Dynatrace Grail and shared across your team">
                  <Flex alignItems="center" gap={4} style={{ 
                    padding: '2px 8px', 
                    borderRadius: 4, 
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    cursor: 'help'
                  }}>
                    <DatabaseIcon style={{ width: 12, height: 12, color: Colors.Text.Primary.Default }} />
                    <Text textStyle="small" style={{ color: Colors.Text.Primary.Default }}>Grail</Text>
                  </Flex>
                </Tooltip>
              </Flex>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                Enter your negotiated rates from your provider contracts. These rates will be used instead of 
                public list prices for cost calculations throughout GCC. Open your rate card document from 
                OpenAI/Anthropic/Azure and enter the per-million token rates.
              </Text>
            </Flex>
          </Flex>
        </Surface>

        {/* Action Bar */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap={8}>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              {customCount > 0 ? (
                <><Strong>{customCount}</Strong> custom rate{customCount > 1 ? 's' : ''} configured</>
              ) : (
                'Using default public pricing'
              )}
            </Text>
            {saveSuccess && (
              <Flex alignItems="center" gap={4}>
                <CheckmarkIcon style={{ width: 14, height: 14, color: Colors.Text.Success.Default }} />
                <Text textStyle="small" style={{ color: Colors.Text.Success.Default }}>Saved to Grail!</Text>
              </Flex>
            )}
          </Flex>
          <Flex gap={8}>
            <Button variant="default" onClick={() => setShowAddNew(true)}>
              <Button.Prefix><PlusIcon /></Button.Prefix>
              Add Model
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
              id="rate-card-import"
            />
            <Tooltip text="Import rate card configuration from JSON file">
              <Button variant="default" onClick={() => document.getElementById('rate-card-import')?.click()}>
                <Button.Prefix><UploadIcon /></Button.Prefix>
                Import
              </Button>
            </Tooltip>
            <Tooltip text="Export your custom rates to JSON file">
              <Button variant="default" onClick={handleExport}>
                <Button.Prefix><DownloadIcon /></Button.Prefix>
                Export
              </Button>
            </Tooltip>
            {customCount > 0 && (
              <Tooltip text="Reset all rates to public list prices">
                <Button variant="default" onClick={handleResetAll}>
                  <Button.Prefix><RefreshIcon /></Button.Prefix>
                  Reset All
                </Button>
              </Tooltip>
            )}
          </Flex>
        </Flex>

        {importError && (
          <Surface style={{ padding: 12, backgroundColor: 'rgba(255, 77, 77, 0.1)', borderRadius: 4 }}>
            <Flex alignItems="center" gap={8}>
              <CriticalIcon style={{ width: 16, height: 16, color: Colors.Text.Critical.Default }} />
              <Text style={{ color: Colors.Text.Critical.Default }}>{importError}</Text>
            </Flex>
          </Surface>
        )}

        {/* Detected Models Alert - Models found in actual usage without rate cards */}
        {unconfiguredModels.length > 0 && (
          <Surface style={{ 
            padding: 16, 
            backgroundColor: 'rgba(255, 170, 0, 0.1)', 
            borderRadius: 8,
            borderLeft: `4px solid ${Colors.Charts.Status.Warning.Default}`
          }}>
            <Flex flexDirection="column" gap={12}>
              <Flex alignItems="center" gap={8}>
                <DocumentIcon style={{ width: 18, height: 18, color: Colors.Charts.Status.Warning.Default }} />
                <Text textStyle="small-emphasized" style={{ color: Colors.Text.Warning.Default }}>
                  {unconfiguredModels.length} Model{unconfiguredModels.length > 1 ? 's' : ''} Detected Without Rate Cards
                </Text>
              </Flex>
              <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                These models are appearing in your actual AI usage but don't have pricing configured. 
                Add rates for accurate cost tracking.
              </Text>
              <Flex flexWrap="wrap" gap={8}>
                {unconfiguredModels.map((dm) => (
                  <Surface
                    key={`${dm.provider}-${dm.model}`}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--dt-colors-surface-default)',
                      borderRadius: 6,
                      border: `1px solid ${Colors.Border.Neutral.Default}`
                    }}
                  >
                    <Flex alignItems="center" gap={8}>
                      <Flex flexDirection="column" gap={2}>
                        <Text textStyle="small-emphasized">{dm.model}</Text>
                        <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued, textTransform: 'capitalize' }}>
                          {dm.provider}
                        </Text>
                      </Flex>
                      <Tooltip text="Add rate card for this model">
                        <Button 
                          variant="default" 
                          onClick={() => {
                            setEditingModel({
                              model: dm.model,
                              provider: dm.provider.toLowerCase(),
                              inputPer1M: 0,
                              outputPer1M: 0,
                              notes: 'Detected from environment usage',
                              isCustom: true,
                            });
                          }}
                        >
                          <PlusIcon />
                        </Button>
                      </Tooltip>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            </Flex>
          </Surface>
        )}

        {/* Provider Tabs */}
        <Tabs>
          {displayData.map((providerCard) => (
            <Tab key={providerCard.provider} title={providerCard.displayName}>
              <Flex flexDirection="column" gap={8} style={{ marginTop: 16 }}>
                {/* Table Header */}
                <Flex style={{ padding: '8px 12px', borderBottom: `1px solid ${Colors.Border.Neutral.Default}` }}>
                  <Text textStyle="small-emphasized" style={{ flex: 2 }}>Model</Text>
                  <Text textStyle="small-emphasized" style={{ flex: 1, textAlign: 'right' }}>Input ($/1M tokens)</Text>
                  <Text textStyle="small-emphasized" style={{ flex: 1, textAlign: 'right' }}>Output ($/1M tokens)</Text>
                  <Text textStyle="small-emphasized" style={{ flex: 1.5 }}>Notes</Text>
                  <Text textStyle="small-emphasized" style={{ width: 120, textAlign: 'center' }}>Actions</Text>
                </Flex>

                {/* Model Rows */}
                {providerCard.models.map((model) => (
                  <Surface 
                    key={`${model.provider}-${model.model}`}
                    style={{ 
                      padding: '12px', 
                      borderRadius: 4,
                      backgroundColor: model.isCustom ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      borderLeft: model.isCustom ? `3px solid ${Colors.Charts.Apdex.Good.Default}` : '3px solid transparent'
                    }}
                  >
                    <Flex alignItems="center">
                      <Flex flex={2} alignItems="center" gap={8}>
                        <Text textStyle="base-emphasized">{model.model}</Text>
                        {model.isCustom && (
                          <Text style={{ 
                            display: 'inline-block',
                            padding: '2px 8px', 
                            borderRadius: 4, 
                            fontSize: 10, 
                            fontWeight: 600,
                            backgroundColor: 'rgba(0, 200, 100, 0.15)',
                            color: Colors.Text.Success.Default 
                          }}>Custom</Text>
                        )}
                      </Flex>
                      <Text style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace' }}>
                        ${model.inputPer1M.toFixed(2)}
                      </Text>
                      <Text style={{ flex: 1, textAlign: 'right', fontFamily: 'monospace' }}>
                        ${model.outputPer1M.toFixed(2)}
                      </Text>
                      <Text textStyle="small" style={{ flex: 1.5, color: Colors.Text.Neutral.Subdued }}>
                        {model.notes || '-'}
                      </Text>
                      <Flex style={{ width: 120 }} justifyContent="center" gap={4}>
                        <Tooltip text="Edit rate">
                          <Button variant="default" onClick={() => setEditingModel(model)}>
                            <EditIcon />
                          </Button>
                        </Tooltip>
                        {model.isCustom && (
                          <Tooltip text="Reset to default">
                            <Button 
                              variant="default" 
                              onClick={() => handleResetToDefault(model.provider, model.model)}
                            >
                              <RefreshIcon />
                            </Button>
                          </Tooltip>
                        )}
                      </Flex>
                    </Flex>
                  </Surface>
                ))}
              </Flex>
            </Tab>
          ))}
        </Tabs>

        {/* How to Find Rates Help */}
        <Surface style={{ padding: 16, background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 8, marginTop: 8 }}>
          <Flex alignItems="flex-start" gap={8}>
            <HelpIcon style={{ width: 16, height: 16, color: Colors.Text.Neutral.Subdued, flexShrink: 0, marginTop: 2 }} />
            <Flex flexDirection="column" gap={8}>
              <Text textStyle="small-emphasized">Where to find your contract rates:</Text>
              <Flex flexDirection="column" gap={4}>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  • <Strong>OpenAI/Azure:</Strong> Check your Portal → Billing → Rate Card or Enterprise Agreement
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  • <Strong>Anthropic:</Strong> Review your Console → Usage → Pricing tier
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  • <Strong>AWS Bedrock:</Strong> AWS Console → Bedrock → Model access → Pricing
                </Text>
                <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
                  • <Strong>Google Vertex:</Strong> Cloud Console → Vertex AI → Pricing or Committed Use Discounts
                </Text>
              </Flex>
            </Flex>
          </Flex>
        </Surface>

        {/* Footer */}
        <Flex justifyContent="flex-end" gap={8} style={{ marginTop: 8 }}>
          <Button variant="emphasized" onClick={onClose}>Done</Button>
        </Flex>
      </Flex>

      {/* Edit Rate Modal */}
      {editingModel && (
        <EditRateModal
          rate={editingModel}
          onSave={handleUpdateRate}
          onClose={() => setEditingModel(null)}
        />
      )}

      {/* Add New Model Modal */}
      {showAddNew && (
        <AddModelModal
          existingProviders={displayData.map(p => p.displayName)}
          onSave={handleUpdateRate}
          onClose={() => setShowAddNew(false)}
        />
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Edit Rate Modal
// ═══════════════════════════════════════════════════════════════════════════════

interface EditRateModalProps {
  rate: RateCardEntry;
  onSave: (rate: RateCardEntry) => void;
  onClose: () => void;
}

function EditRateModal({ rate, onSave, onClose }: EditRateModalProps) {
  const [inputRate, setInputRate] = useState(rate.inputPer1M.toString());
  const [outputRate, setOutputRate] = useState(rate.outputPer1M.toString());
  const [notes, setNotes] = useState(rate.notes || '');

  const handleSave = () => {
    onSave({
      ...rate,
      inputPer1M: parseFloat(inputRate) || 0,
      outputPer1M: parseFloat(outputRate) || 0,
      notes: notes || undefined,
    });
  };

  // Calculate example cost for reference
  const exampleInputTokens = 100000;
  const exampleOutputTokens = 50000;
  const exampleCost = (exampleInputTokens / 1_000_000) * (parseFloat(inputRate) || 0) + 
                      (exampleOutputTokens / 1_000_000) * (parseFloat(outputRate) || 0);

  return (
    <Modal
      title={`Edit Rate: ${rate.model}`}
      show={true}
      onDismiss={onClose}
      size="small"
    >
      <Flex flexDirection="column" gap={16} style={{ padding: 8 }}>
        <Surface style={{ padding: 12, background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 8 }}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Enter rates as shown on your provider's rate card or invoice. 
            Rates are in <Strong>USD per 1 million tokens</Strong>.
          </Text>
        </Surface>

        <Flex flexDirection="column" gap={12}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Input Tokens ($/1M tokens)</Text>
            <TextInput
              value={inputRate}
              onChange={(value) => setInputRate(value)}
              placeholder="e.g., 2.50"
            />
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Also called "prompt tokens" or "request tokens"
            </Text>
          </Flex>

          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Output Tokens ($/1M tokens)</Text>
            <TextInput
              value={outputRate}
              onChange={(value) => setOutputRate(value)}
              placeholder="e.g., 10.00"
            />
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Also called "completion tokens" or "response tokens"
            </Text>
          </Flex>

          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Notes (optional)</Text>
            <TextInput
              value={notes}
              onChange={(value) => setNotes(value)}
              placeholder="e.g., Enterprise discount, Azure commitment"
            />
          </Flex>
        </Flex>

        {/* Example Calculation */}
        <Surface style={{ padding: 12, background: 'rgba(99, 102, 241, 0.08)', borderRadius: 8 }}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Example Calculation</Text>
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              100K input + 50K output tokens = <Strong>${exampleCost.toFixed(4)}</Strong>
            </Text>
          </Flex>
        </Surface>

        <Flex justifyContent="flex-end" gap={8}>
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button variant="emphasized" onClick={handleSave}>
            <Button.Prefix><CheckmarkIcon /></Button.Prefix>
            Save Rate
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Add New Model Modal
// ═══════════════════════════════════════════════════════════════════════════════

interface AddModelModalProps {
  existingProviders: string[];
  onSave: (rate: RateCardEntry) => void;
  onClose: () => void;
}

function AddModelModal({ existingProviders, onSave, onClose }: AddModelModalProps) {
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [inputRate, setInputRate] = useState('');
  const [outputRate, setOutputRate] = useState('');
  const [notes, setNotes] = useState('');

  const canSave = provider.trim() && model.trim() && inputRate.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      provider: provider.trim().toLowerCase(),
      model: model.trim(),
      inputPer1M: parseFloat(inputRate) || 0,
      outputPer1M: parseFloat(outputRate) || 0,
      notes: notes || undefined,
    });
    onClose();
  };

  return (
    <Modal
      title="Add New Model"
      show={true}
      onDismiss={onClose}
      size="small"
    >
      <Flex flexDirection="column" gap={16} style={{ padding: 8 }}>
        <Surface style={{ padding: 12, background: 'var(--dt-colors-surface-neutral-subdued)', borderRadius: 8 }}>
          <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
            Add a model that's not in the default list. This is useful for new models, 
            private deployments, or custom fine-tuned models.
          </Text>
        </Surface>

        <Flex flexDirection="column" gap={12}>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Provider *</Text>
            <TextInput
              value={provider}
              onChange={(value) => setProvider(value)}
              placeholder="e.g., openai, anthropic, azure_openai"
            />
            <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
              Use the same provider name as seen in your traces (lowercase)
            </Text>
          </Flex>

          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Model Name *</Text>
            <TextInput
              value={model}
              onChange={(value) => setModel(value)}
              placeholder="e.g., gpt-4o-custom, my-fine-tuned-model"
            />
          </Flex>

          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Input Tokens ($/1M tokens) *</Text>
            <TextInput
              value={inputRate}
              onChange={(value) => setInputRate(value)}
              placeholder="e.g., 2.50"
            />
          </Flex>

          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Output Tokens ($/1M tokens)</Text>
            <TextInput
              value={outputRate}
              onChange={(value) => setOutputRate(value)}
              placeholder="e.g., 10.00 (0 for embeddings)"
            />
          </Flex>

          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small-emphasized">Notes (optional)</Text>
            <TextInput
              value={notes}
              onChange={(value) => setNotes(value)}
              placeholder="e.g., Fine-tuned for customer service"
            />
          </Flex>
        </Flex>

        <Flex justifyContent="flex-end" gap={8}>
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button variant="emphasized" onClick={handleSave} disabled={!canSave}>
            <Button.Prefix><PlusIcon /></Button.Prefix>
            Add Model
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
}

export default RateCardSettings;
