// Ask Dynatrace Intelligence Assist — Trigger Button
// Small AI icon button that opens the contextual AI sheet

import React from 'react';
import { Button } from '@dynatrace/strato-components/buttons';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { AiIcon } from '@dynatrace/strato-icons';

interface AskAIButtonProps {
  /** Tooltip label, e.g. "Ask AI about OpenAI costs" */
  label?: string;
  onClick: () => void;
  /** Render as small inline icon (default) or full button */
  variant?: 'icon' | 'button';
}

export const AskAIButton: React.FC<AskAIButtonProps> = ({
  label = 'Ask Dynatrace Intelligence',
  onClick,
  variant = 'icon',
}) => {
  if (variant === 'button') {
    return (
      <Tooltip text={label}>
        <Button variant="emphasized" color="primary" onClick={onClick}>
          <Button.Prefix><AiIcon /></Button.Prefix>
          Ask AI
        </Button>
      </Tooltip>
    );
  }

  return (
    <Tooltip text={label}>
      <Button
        variant="default"
        onClick={onClick}
        aria-label={label}
        style={{
          padding: 2,
          minWidth: 'auto',
          minHeight: 44,
          color: 'var(--dt-colors-text-primary-default)',
        }}
      >
        <AiIcon />
      </Button>
    </Tooltip>
  );
};
