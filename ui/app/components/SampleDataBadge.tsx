// GenAI Control Center - Sample Data Badge Component
// Clearly indicates when data is static/sample vs. live from Dynatrace

import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Text } from '@dynatrace/strato-components/typography';
import { Tooltip } from '@dynatrace/strato-components-preview/overlays';
import { Colors } from '@dynatrace/strato-design-tokens';

interface SampleDataBadgeProps {
  type?: 'sample' | 'reference' | 'static' | 'beta';
  tooltip?: string;
  lastVerified?: string;
  style?: React.CSSProperties;
}

/**
 * Badge to indicate sample/reference data that isn't pulled from live Dynatrace data
 */
export const SampleDataBadge: React.FC<SampleDataBadgeProps> = ({ 
  type = 'sample',
  tooltip,
  lastVerified,
  style 
}) => {
  const configs = {
    sample: {
      label: 'SAMPLE DATA',
      icon: '📋',
      bgColor: 'rgba(99, 102, 241, 0.15)',
      textColor: '#6366f1',
      defaultTooltip: 'This section shows sample/example data for demonstration purposes.',
    },
    reference: {
      label: 'REFERENCE DATA',
      icon: 'ℹ️',
      bgColor: 'rgba(59, 130, 246, 0.15)',
      textColor: '#3b82f6',
      defaultTooltip: 'This data is based on public information. Verify with your provider.',
    },
    static: {
      label: 'STATIC',
      icon: '📌',
      bgColor: 'rgba(156, 163, 175, 0.2)',
      textColor: '#6b7280',
      defaultTooltip: 'This content is not dynamically updated from Dynatrace.',
    },
    beta: {
      label: 'BETA',
      icon: '🧪',
      bgColor: 'rgba(245, 158, 11, 0.15)',
      textColor: '#f59e0b',
      defaultTooltip: 'This feature is in beta and may change.',
    },
  };

  const config = configs[type];
  const displayTooltip = tooltip || config.defaultTooltip + 
    (lastVerified ? ` Last verified: ${lastVerified}` : '');

  const badge = (
    <Flex 
      alignItems="center" 
      gap={4}
      style={{
        padding: '2px 8px',
        borderRadius: 4,
        backgroundColor: config.bgColor,
        display: 'inline-flex',
        ...style,
      }}
    >
      <span style={{ fontSize: 10 }}>{config.icon}</span>
      <Text textStyle="small" style={{ 
        fontSize: 9, 
        fontWeight: 600, 
        color: config.textColor,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {config.label}
      </Text>
    </Flex>
  );

  return (
    <Tooltip text={displayTooltip}>
      {badge}
    </Tooltip>
  );
};

/**
 * Inline version for use within text
 */
export const SampleDataIndicator: React.FC<{ type?: 'sample' | 'reference' | 'static' }> = ({ 
  type = 'sample' 
}) => {
  const icons = {
    sample: '📋',
    reference: 'ℹ️',
    static: '📌',
  };
  
  return (
    <Tooltip text={`This is ${type} data`}>
      <span style={{ cursor: 'help', marginLeft: 4 }}>{icons[type]}</span>
    </Tooltip>
  );
};

export default SampleDataBadge;
