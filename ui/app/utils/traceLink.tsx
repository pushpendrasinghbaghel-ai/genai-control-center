// Shared utility for opening traces in Dynatrace Distributed Tracing app
// Eliminates duplication across pages

import React from 'react';
import { getIntentLink } from '@dynatrace-sdk/navigation';
import { ExternalLinkIcon } from '@dynatrace/strato-icons';

/**
 * Open a trace in the Dynatrace Distributed Tracing app.
 * Creates a ±10 minute window around the timestamp for the trace lookup.
 */
export const openTraceInDistributedTraces = (traceId: string, timestamp?: string): void => {
  // With timestamp: ±1 hour window. Without: last 72 hours (matches typical query range).
  const now = new Date();
  const timeDate = timestamp ? new Date(timestamp) : now;
  const windowMs = timestamp ? 60 * 60 * 1000 : 72 * 60 * 60 * 1000;
  const startTime = new Date(timeDate.getTime() - windowMs).toISOString();
  const endTime = (timestamp ? new Date(timeDate.getTime() + 60 * 60 * 1000) : now).toISOString();

  const intentUrl = getIntentLink(
    {
      'trace_id': traceId,
      'dt.timeframe': { from: startTime, to: endTime },
    },
    'dynatrace.distributedtracing',
    'view-trace'
  );

  window.open(intentUrl, '_blank', 'noopener,noreferrer');
};

/**
 * Inline clickable trace ID component.
 * Shows truncated trace ID as a monospace link that opens in Distributed Tracing.
 */
export const TraceLink: React.FC<{
  traceId: string;
  timestamp?: string;
  truncate?: number;
}> = ({ traceId, timestamp, truncate = 16 }) => {
  if (!traceId || traceId === '—') {
    return <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--dt-colors-text-secondary-default)' }}>—</span>;
  }

  const display = traceId.length > truncate ? traceId.substring(0, truncate) + '…' : traceId;

  return (
    <span
      role="link"
      tabIndex={0}
      title={`Open trace ${traceId} in Distributed Tracing`}
      onClick={() => openTraceInDistributedTraces(traceId, timestamp)}
      onKeyDown={(e) => { if (e.key === 'Enter') openTraceInDistributedTraces(traceId, timestamp); }}
      style={{
        fontSize: 11,
        fontFamily: 'monospace',
        color: 'var(--dt-colors-text-accent-default)',
        cursor: 'pointer',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {display}
      <ExternalLinkIcon style={{ width: 10, height: 10, opacity: 0.7 }} />
    </span>
  );
};
