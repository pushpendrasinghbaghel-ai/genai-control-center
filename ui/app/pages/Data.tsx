import React, { useState } from "react";

import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import {
  RunQueryButton,
  type QueryStateType,
} from "@dynatrace/strato-components/buttons";
import {
  TimeseriesChart,
  convertToTimeseries,
} from "@dynatrace/strato-components/charts";
import { DQLEditor } from "@dynatrace/strato-components/editors";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { CriticalIcon } from "@dynatrace/strato-icons";
import { useDql } from "@dynatrace-sdk/react-hooks";

// GenAI-specific preset queries
const PRESET_QUERIES = [
  {
    name: 'GenAI Requests Over Time',
    query: `fetch spans, from: now()-24h
| filter isNotNull(gen_ai.request.model)
| summarize count(), by:{bin(timestamp, 1h)}`,
  },
  {
    name: 'Token Usage by Model',
    query: `fetch spans, from: now()-24h
| filter isNotNull(gen_ai.request.model)
| summarize 
    total_input = sum(gen_ai.usage.input_tokens),
    total_output = sum(gen_ai.usage.output_tokens)
  by:{gen_ai.request.model}
| sort total_input desc`,
  },
  {
    name: 'Average Latency by Provider',
    query: `fetch spans, from: now()-24h
| filter isNotNull(gen_ai.provider.name)
| summarize avg_latency_ms = avg(duration) / 1000000
  by:{gen_ai.provider.name}
| sort avg_latency_ms desc`,
  },
  {
    name: 'Slow Requests (>5s)',
    query: `fetch spans, from: now()-24h
| filter isNotNull(gen_ai.request.model) AND duration > 5000000000
| fields timestamp, dt.entity.service, gen_ai.request.model, duration / 1000000000 [as] "duration_seconds"
| sort duration desc
| limit 50`,
  },
  {
    name: 'Error Rate by Service',
    query: `fetch spans, from: now()-24h
| filter isNotNull(gen_ai.request.model)
| summarize 
    total = count(),
    errors = countIf(status.code == "ERROR"),
    error_rate = countIf(status.code == "ERROR") / count() * 100
  by:{dt.entity.service}
| sort error_rate desc`,
  },
];

export const Data = () => {
  const initialQuery = PRESET_QUERIES[0].query;

  const [editorQueryString, setEditorQueryString] =
    useState<string>(initialQuery);
  const [queryString, setQueryString] = useState<string>(initialQuery);

  const { data, error, isLoading, cancel, refetch } = useDql({
    query: queryString,
  });

  // onClickQuery function is executed when the "RUN QUERY" Button is clicked and fetches the data from Grail.
  function onClickQuery() {
    if (isLoading) {
      void cancel();
    } else {
      if (queryString !== editorQueryString) setQueryString(editorQueryString);
      else void refetch();
    }
  }

  const loadPreset = (query: string) => {
    setEditorQueryString(query);
    setQueryString(query);
  };

  let queryState: QueryStateType;
  if (error) {
    queryState = "error";
  } else if (isLoading) {
    queryState = "loading";
  } else if (data) {
    queryState = "success";
  } else {
    queryState = "idle";
  }

  return (
    <Flex flexDirection="column" padding={24} gap={16}>
      {/* Compact Header */}
      <Text style={{ color: 'var(--dt-colors-text-secondary-default)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600 }}>
        Query GenAI Spans & Metrics Using DQL
      </Text>

      {/* Preset Queries */}
      <Surface style={{ padding: 12, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
        <Flex flexDirection="column" gap={8}>
          <Text style={{ fontWeight: 600, fontSize: 12 }}>Quick Queries:</Text>
          <Flex gap={8} flexWrap="wrap">
            {PRESET_QUERIES.map((preset, idx) => (
              <Button 
                key={idx} 
                variant="default" 
                onClick={() => loadPreset(preset.query)}
              >
                {preset.name}
              </Button>
            ))}
          </Flex>
        </Flex>
      </Surface>

      {/* DQL Editor */}
      <Flex flexDirection="column" gap={8}>
        <DQLEditor
          value={editorQueryString}
          onChange={(event) => setEditorQueryString(event)}
        />
        <Flex justifyContent={error ? "space-between" : "flex-end"}>
          {error && (
            <Flex
              alignItems={"center"}
              style={{ color: Colors.Text.Critical.Default }}
            >
              <CriticalIcon />
              <Paragraph>{error.message}</Paragraph>
            </Flex>
          )}
          <RunQueryButton
            onClick={onClickQuery}
            queryState={queryState}
          />
        </Flex>
      </Flex>

      {/* Results */}
      {data?.records && data.records.length > 0 && (() => {
        // Check if data has timeseries-compatible fields (timeframe or timestamp)
        const firstRecord = data.records[0] as Record<string, unknown> | null;
        const hasTimefield = firstRecord && (
          'timeframe' in firstRecord ||
          'timestamp' in firstRecord ||
          Object.keys(firstRecord).some(k => k.startsWith('bin('))
        );

        if (hasTimefield) {
          try {
            const tsData = convertToTimeseries(data.records, data.types);
            return (
              <Surface style={{ padding: 16 }}>
                <TimeseriesChart data={tsData} gapPolicy="connect" variant="line" />
              </Surface>
            );
          } catch {
            // Fall through to table if conversion fails
          }
        }

        // Tabular fallback
        const keys = Object.keys(firstRecord || {});
        const columns = keys.map(key => ({
          id: key,
          header: key,
          accessor: key,
        }));
        return (
          <Surface style={{ padding: 16 }}>
            <DataTable
              data={data.records as Record<string, unknown>[]}
              columns={columns}
              sortable
              resizable
            >
              <DataTable.Pagination defaultPageSize={20} />
            </DataTable>
          </Surface>
        );
      })()}

      {data?.records && data.records.length === 0 && (
        <Surface style={{ padding: 24, textAlign: 'center' }}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>
            No results found. Try adjusting your query or timeframe.
          </Text>
        </Surface>
      )}
    </Flex>
  );
};
