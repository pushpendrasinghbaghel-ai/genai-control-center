// GenAI Control Center - Loading Skeleton Components
// Provides visual placeholders during data loading

import React from 'react';
import { Flex, Surface } from '@dynatrace/strato-components/layouts';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: React.CSSProperties;
}

/**
 * Base skeleton element with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = 16, 
  borderRadius = 4,
  style 
}) => (
  <Flex style={{
      width,
      height,
      borderRadius,
      backgroundColor: 'var(--dt-colors-background-default-secondary)',
      background: 'linear-gradient(90deg, var(--dt-colors-background-default-secondary) 25%, var(--dt-colors-surface-default) 50%, var(--dt-colors-background-default-secondary) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }}
  />
);

/**
 * Skeleton for a stat card (used in dashboards)
 */
export const StatCardSkeleton: React.FC = () => (
  <Surface padding={16} style={{ 
    borderRadius: 8, 
    minWidth: 140,
    border: '1px solid var(--dt-colors-border-neutral-default)'
  }}>
    <Flex flexDirection="column" gap={8}>
      <Skeleton width={80} height={12} />
      <Skeleton width={60} height={32} />
      <Skeleton width={100} height={10} />
    </Flex>
  </Surface>
);

/**
 * Skeleton for a service/provider card
 */
export const ServiceCardSkeleton: React.FC = () => (
  <Surface style={{ padding: 16, borderRadius: 8 }}>
    <Flex flexDirection="column" gap={12}>
      <Flex justifyContent="space-between" alignItems="center">
        <Skeleton width={180} height={20} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </Flex>
      <Flex gap={16}>
        <Skeleton width={80} height={14} />
        <Skeleton width={80} height={14} />
        <Skeleton width={80} height={14} />
      </Flex>
      <Skeleton width="100%" height={8} />
    </Flex>
  </Surface>
);

/**
 * Skeleton for a table row
 */
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <Flex gap={16} padding={12} style={{ borderBottom: '1px solid var(--dt-colors-border-neutral-default)' }}>
    {Array.from({ length: columns }).map((_, i) => (
      <Skeleton key={i} width={`${100 / columns}%`} height={16} />
    ))}
  </Flex>
);

/**
 * Skeleton for a full table
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 5 
}) => (
  <Surface style={{ padding: 16, borderRadius: 8 }}>
    <Flex flexDirection="column" gap={0}>
      {/* Header */}
      <Flex gap={16} padding={12} style={{ 
        borderBottom: '2px solid var(--dt-colors-border-neutral-default)',
        backgroundColor: 'var(--dt-colors-background-default-secondary)'
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height={14} />
        ))}
      </Flex>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </Flex>
  </Surface>
);

/**
 * Skeleton for a chart area
 */
export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 200 }) => (
  <Surface style={{ padding: 16, borderRadius: 8 }}>
    <Flex flexDirection="column" gap={12}>
      <Skeleton width={150} height={18} />
      <Skeleton width="100%" height={height} borderRadius={8} />
    </Flex>
  </Surface>
);

/**
 * Skeleton for the dashboard overview
 */
export const DashboardSkeleton: React.FC = () => (
  <Flex flexDirection="column" gap={16} padding={16}>
    {/* Header */}
    <Flex justifyContent="space-between" alignItems="center">
      <Skeleton width={200} height={28} />
      <Skeleton width={120} height={36} borderRadius={4} />
    </Flex>
    
    {/* Stat Cards */}
    <Flex gap={16}>
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </Flex>
    
    {/* Main Content */}
    <Flex gap={16}>
      <Flex style={{ flex: 2 }}>
        <ChartSkeleton height={250} />
      </Flex>
      <Flex style={{ flex: 1 }}>
        <TableSkeleton rows={4} columns={3} />
      </Flex>
    </Flex>
    
    {/* Service Cards */}
    <Flex gap={16}>
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
    </Flex>
  </Flex>
);

/**
 * Add shimmer animation styles (add to your global CSS or styled-components)
 */
export const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// Inject keyframes into document head
if (typeof document !== 'undefined') {
  const styleId = 'gcc-skeleton-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = shimmerKeyframes;
    document.head.appendChild(style);
  }
}

export default {
  Skeleton,
  StatCardSkeleton,
  ServiceCardSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  ChartSkeleton,
  DashboardSkeleton,
};
