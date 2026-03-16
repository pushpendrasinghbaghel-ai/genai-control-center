// Ask Dynatrace Intelligence Assist — Trigger Button
// Small AI icon button that opens the contextual AI sheet

import React from 'react';
import { Button } from '@dynatrace/strato-components/buttons';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
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
      <button
        onClick={onClick}
        aria-label={label}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 4,
          color: 'var(--dt-colors-text-primary-default)',
          opacity: 0.7,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
      >
        <AiIcon style={{ width: 14, height: 14 }} />
      </button>
    </Tooltip>
  );
};
