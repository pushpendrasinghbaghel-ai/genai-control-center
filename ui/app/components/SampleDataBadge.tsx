// GenAI Control Center - Sample Data Badge Component
// Clearly indicates when data is static/sample vs. live from Dynatrace

import React from 'react';
import { Flex } from '@dynatrace/strato-components/layouts';
import { Text } from '@dynatrace/strato-components/typography';
import { Tooltip } from '@dynatrace/strato-components/overlays';
import { Colors } from '@dynatrace/strato-design-tokens';
import { DocumentIcon, HelpIcon, PinIcon, WarningIcon } from '@dynatrace/strato-icons';

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
      icon: <DocumentIcon style={{ width: 10, height: 10 }} />,
      bgColor: 'rgba(99, 102, 241, 0.15)',
      textColor: 'var(--dt-colors-charts-categorical-color-06-default)',
      defaultTooltip: 'This section shows sample/example data for demonstration purposes.',
    },
    reference: {
      label: 'REFERENCE DATA',
      icon: <HelpIcon style={{ width: 10, height: 10 }} />,
      bgColor: 'rgba(59, 130, 246, 0.15)',
      textColor: 'var(--dt-colors-charts-categorical-color-01-default)',
      defaultTooltip: 'This data is based on public information. Verify with your provider.',
    },
    static: {
      label: 'STATIC',
      icon: <PinIcon style={{ width: 10, height: 10 }} />,
      bgColor: 'rgba(156, 163, 175, 0.2)',
      textColor: 'var(--dt-colors-text-neutral-default)',
      defaultTooltip: 'This content is not dynamically updated from Dynatrace.',
    },
    beta: {
      label: 'BETA',
      icon: <WarningIcon style={{ width: 10, height: 10 }} />,
      bgColor: 'rgba(245, 158, 11, 0.15)',
      textColor: 'var(--dt-colors-charts-status-warning-default)',
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
      <Text style={{ display: 'flex', alignItems: 'center', color: config.textColor }}>{config.icon}</Text>
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
  const icons: Record<string, React.ReactNode> = {
    sample: <DocumentIcon style={{ width: 12, height: 12 }} />,
    reference: <HelpIcon style={{ width: 12, height: 12 }} />,
    static: <PinIcon style={{ width: 12, height: 12 }} />,
  };
  
  return (
    <Tooltip text={`This is ${type} data`}>
      <Text style={{ cursor: 'help', marginLeft: 4, display: 'inline-flex', alignItems: 'center' }}>{icons[type]}</Text>
    </Tooltip>
  );
};

export default SampleDataBadge;
