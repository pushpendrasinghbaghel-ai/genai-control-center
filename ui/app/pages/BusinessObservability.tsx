// GenAI Control Center — Business Observability Dashboard
// Tailored for FinTech lending platforms: Tracks AI-driven business outcomes
// (loan approvals, fraud detection, compliance) correlated with system telemetry.

import React, { useState, useMemo, useCallback } from "react";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { TitleBar } from "@dynatrace/strato-components/layouts";
import { Paragraph, Strong, Heading, Text } from "@dynatrace/strato-components/typography";
import { ProgressBar, ProgressCircle } from "@dynatrace/strato-components/content";
import { TimeseriesChart, DonutChart } from "@dynatrace/strato-components/charts";
import { SingleValue } from "@dynatrace/strato-components/charts";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { Tabs, Tab } from "@dynatrace/strato-components-preview/navigation";
import type { Timeseries } from "@dynatrace/strato-components/charts";
import { Colors } from "@dynatrace/strato-design-tokens";
import {
  MoneyIcon,
  CheckmarkIcon,
  CriticalIcon,
  WarningIcon,
  ClockIcon,
  BarChartIcon,
  ServicesIcon,
  AiIcon,
  AgentIcon,
  LockIcon,
  DatabaseIcon,
  HostsIcon,
  ServiceLevelObjectivesIcon,
} from "@dynatrace/strato-icons";
import { SampleDataBadge } from "../components";
import { formatNumber } from '../utils/formatting';

// ── Dynatrace Color Tokens ────────────────────────────────────────────
const STATUS = {
  ideal: Colors.Charts.Status.Ideal.Default,
  good: Colors.Charts.Status.Good.Default,
  warning: Colors.Charts.Status.Warning.Default,
  critical: Colors.Charts.Status.Critical.Default,
  neutral: Colors.Charts.Status.Neutral.Default,
};

const CAT = [
  Colors.Charts.Categorical.Color01.Default,
  Colors.Charts.Categorical.Color02.Default,
  Colors.Charts.Categorical.Color03.Default,
  Colors.Charts.Categorical.Color04.Default,
  Colors.Charts.Categorical.Color05.Default,
  Colors.Charts.Categorical.Color06.Default,
  Colors.Charts.Categorical.Color07.Default,
  Colors.Charts.Categorical.Color08.Default,
];

// ── Sample Data Generator ─────────────────────────────────────────────
// Generates realistic data for a FinTech lending platform demo

const now = Date.now();
const HOUR = 3600_000;
const DAY = 86400_000;

/** Generate hourly timeseries datapoints for the last N hours */
const hourlyPoints = (hours: number, baseFn: (i: number) => number): Array<{ start: Date; value: number }> =>
  Array.from({ length: hours }, (_, i) => ({
    start: new Date(now - (hours - i) * HOUR),
    value: Math.round(baseFn(i) * 100) / 100,
  }));

// ── Business KPIs (Jocata GRID-style) ──────────────────────────────────

const BUSINESS_KPIS = {
  loanApplications: {
    today: 12_847,
    approved: 9_231,
    rejected: 2_416,
    pending: 1_200,
    avgDecisionTime: 2.3, // seconds
    slaTarget: 3.0,
    slaCompliance: 98.7,
    aiAssistedPct: 94.2,
  },
  kycVerifications: {
    total: 15_320,
    automated: 14_280,
    manualReview: 1_040,
    avgProcessingTime: 1.8,
    successRate: 99.1,
  },
  fraudDetection: {
    scannedTransactions: 2_450_000,
    flagged: 3_847,
    confirmed: 892,
    falsePositiveRate: 4.2,
    avgDetectionLatency: 0.34, // seconds
    blockedAmount: 4_720_000,
  },
  amlCompliance: {
    alerts: 1_247,
    aiTriaged: 1_180,
    escalated: 67,
    falsePositiveReduction: 76.3,
    regulatoryReportsFiled: 23,
  },
};

// ── Timeseries Data ────────────────────────────────────────────────────

const loanVolumeTs: Timeseries[] = [
  {
    name: "Approved",
    datapoints: hourlyPoints(24, (i) => 380 + Math.sin(i / 3) * 60 + Math.random() * 40),
  },
  {
    name: "Rejected",
    datapoints: hourlyPoints(24, (i) => 95 + Math.cos(i / 4) * 25 + Math.random() * 15),
  },
  {
    name: "Pending Review",
    datapoints: hourlyPoints(24, (i) => 50 + Math.sin(i / 5) * 20 + Math.random() * 10),
  },
];

const decisionLatencyTs: Timeseries[] = [
  {
    name: "AI Decision (P95)",
    datapoints: hourlyPoints(24, (i) => 2.1 + Math.sin(i / 6) * 0.4 + Math.random() * 0.3),
  },
  {
    name: "SLA Target",
    datapoints: hourlyPoints(24, () => 3.0),
  },
];

const fraudDetectionTs: Timeseries[] = [
  {
    name: "Transactions Scanned (K)",
    datapoints: hourlyPoints(24, (i) => 102 + Math.sin(i / 4) * 15 + Math.random() * 8),
  },
  {
    name: "Flagged",
    datapoints: hourlyPoints(24, (i) => 160 + Math.cos(i / 3) * 40 + Math.random() * 20),
  },
];

const revenueImpactTs: Timeseries[] = [
  {
    name: "Revenue Protected ($K)",
    datapoints: hourlyPoints(24, (i) => 196 + Math.sin(i / 5) * 35 + Math.random() * 15),
  },
  {
    name: "Cost Saved via AI ($K)",
    datapoints: hourlyPoints(24, (i) => 42 + Math.cos(i / 6) * 10 + Math.random() * 5),
  },
];

const kycProcessingTs: Timeseries[] = [
  {
    name: "eKYC Automated",
    datapoints: hourlyPoints(24, (i) => 595 + Math.sin(i / 3) * 60 + Math.random() * 30),
  },
  {
    name: "Manual Review",
    datapoints: hourlyPoints(24, (i) => 43 + Math.cos(i / 4) * 12 + Math.random() * 8),
  },
];

const amlAlertTs: Timeseries[] = [
  {
    name: "AI Auto-Triaged",
    datapoints: hourlyPoints(24, (i) => 49 + Math.sin(i / 4) * 10 + Math.random() * 5),
  },
  {
    name: "Escalated to Analyst",
    datapoints: hourlyPoints(24, (i) => 2.8 + Math.cos(i / 5) * 1.2 + Math.random() * 0.5),
  },
];

// ── Donut Data ─────────────────────────────────────────────────────────

const loanChannelDonut = { slices: [
  { category: "Mobile App", value: 5_140, color: CAT[0] },
  { category: "Web Portal", value: 3_850, color: CAT[1] },
  { category: "Partner API", value: 2_420, color: CAT[2] },
  { category: "Branch (Digital)", value: 1_437, color: CAT[3] },
] };

const modelUsageDonut = { slices: [
  { category: "Credit Scoring (GPT-4o)", value: 42, color: CAT[0] },
  { category: "Document OCR (Claude 3.5)", value: 28, color: CAT[1] },
  { category: "Fraud Detection (Gemini Pro)", value: 18, color: CAT[2] },
  { category: "AML Triage (Llama 3)", value: 12, color: CAT[3] },
] };

// ── Service Health Table ───────────────────────────────────────────────

const serviceHealthData = [
  { service: "Loan Origination Engine", provider: "Azure OpenAI", model: "gpt-4o", latencyP95: 1.82, errorRate: 0.12, throughput: 4_250, status: "healthy", tokens24h: 2_847_000 },
  { service: "eKYC Document Processor", provider: "Anthropic", model: "claude-3.5-sonnet", latencyP95: 2.14, errorRate: 0.08, throughput: 3_180, status: "healthy", tokens24h: 1_920_000 },
  { service: "Fraud Pattern Detector", provider: "Google", model: "gemini-1.5-pro", latencyP95: 0.34, errorRate: 0.05, throughput: 102_400, status: "healthy", tokens24h: 5_120_000 },
  { service: "AML Alert Triager", provider: "Meta (Self-hosted)", model: "llama-3-70b", latencyP95: 1.47, errorRate: 0.23, throughput: 1_180, status: "warning", tokens24h: 890_000 },
  { service: "Credit Bureau Aggregator", provider: "Azure OpenAI", model: "gpt-4o-mini", latencyP95: 0.92, errorRate: 0.03, throughput: 8_740, status: "healthy", tokens24h: 1_340_000 },
  { service: "Regulatory Report Generator", provider: "Anthropic", model: "claude-3.5-sonnet", latencyP95: 3.21, errorRate: 0.31, throughput: 420, status: "warning", tokens24h: 680_000 },
  { service: "Customer Sentiment Analyzer", provider: "Google", model: "gemini-1.5-flash", latencyP95: 0.56, errorRate: 0.02, throughput: 6_300, status: "healthy", tokens24h: 1_580_000 },
  { service: "Underwriting Risk Scorer", provider: "Azure OpenAI", model: "gpt-4o", latencyP95: 2.87, errorRate: 0.15, throughput: 2_800, status: "healthy", tokens24h: 2_140_000 },
];

// ── SLO Table ──────────────────────────────────────────────────────────

const sloData = [
  { name: "Loan Decision Latency", target: "< 3s (P95)", current: "2.3s", status: "met", burnRate: 0.2, remaining: "23.4h" },
  { name: "eKYC Processing Success", target: "> 99%", current: "99.1%", status: "met", burnRate: 0.1, remaining: "47.2h" },
  { name: "Fraud Detection Latency", target: "< 500ms", current: "340ms", status: "met", burnRate: 0.15, remaining: "38.1h" },
  { name: "AML False Positive Rate", target: "< 5%", current: "4.2%", status: "at_risk", burnRate: 0.8, remaining: "4.7h" },
  { name: "API Availability (GRID)", target: "> 99.95%", current: "99.97%", status: "met", burnRate: 0.05, remaining: "156h" },
  { name: "Regulatory Report SLA", target: "< 5s", current: "3.2s", status: "met", burnRate: 0.3, remaining: "18.6h" },
];

// ── Recent Events Table ────────────────────────────────────────────────

const recentEvents = [
  { time: "14:32", event: "Credit Bureau API latency spike detected", severity: "warning", service: "Credit Bureau Aggregator", aiAction: "Failover to secondary bureau initiated" },
  { time: "13:45", event: "AML model accuracy drift detected (−2.1%)", severity: "warning", service: "AML Alert Triager", aiAction: "Davis flagged for review, retraining queued" },
  { time: "12:18", event: "Loan decisioning SLA breach averted", severity: "info", service: "Loan Origination Engine", aiAction: "Auto-scaled from 3→5 replicas" },
  { time: "11:02", event: "New fraud pattern cluster identified", severity: "critical", service: "Fraud Pattern Detector", aiAction: "Pattern added to real-time ruleset" },
  { time: "09:47", event: "RBI compliance report generated automatically", severity: "info", service: "Regulatory Report Generator", aiAction: "Submitted to compliance portal" },
  { time: "08:15", event: "eKYC document processing error burst", severity: "warning", service: "eKYC Document Processor", aiAction: "Circuit breaker triggered, 0 customer impact" },
];

// ── Helper Components ──────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtext?: string;
  color?: string;
  trend?: { direction: "up" | "down"; value: string; good?: boolean };
}> = ({ label, value, icon, subtext, color, trend }) => (
  <Surface padding={16} style={{ borderRadius: 8, flex: 1, minWidth: 180 }}>
    <Flex flexDirection="column" gap={4}>
      <Flex alignItems="center" gap={6}>
        <Text style={{ color: color || "var(--dt-colors-text-secondary-default)", display: "flex" }}>{icon}</Text>
        <Text style={{ fontSize: 11, color: "var(--dt-colors-text-secondary-default)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      </Flex>
      <Text style={{ fontSize: 28, fontWeight: 700, color: color || "inherit", lineHeight: 1.1 }}>{value}</Text>
      {trend && (
        <Text style={{ fontSize: 11, color: trend.good ? STATUS.ideal : STATUS.critical, fontWeight: 500 }}>
          {trend.direction === "up" ? "▲" : "▼"} {trend.value}
        </Text>
      )}
      {subtext && (
        <Text style={{ fontSize: 11, color: "var(--dt-colors-text-secondary-default)" }}>{subtext}</Text>
      )}
    </Flex>
  </Surface>
);

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <Flex flexDirection="column" gap={2} style={{ marginBottom: 4 }}>
    <Strong style={{ fontSize: 15 }}>{title}</Strong>
    {subtitle && <Text style={{ fontSize: 11, color: "var(--dt-colors-text-secondary-default)" }}>{subtitle}</Text>}
  </Flex>
);

const ChartCard: React.FC<{ title: string; height?: number; children: React.ReactNode }> = ({ title, height = 200, children }) => (
  <Surface padding={16} style={{ borderRadius: 8, flex: 1, minWidth: 300 }}>
    <Flex flexDirection="column" gap={8}>
      <Strong style={{ fontSize: 13 }}>{title}</Strong>
      <Flex style={{ height }}>{children}</Flex>
    </Flex>
  </Surface>
);

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const color = status === "healthy" ? STATUS.ideal : status === "warning" ? STATUS.warning : STATUS.critical;
  return <Text style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />;
};

// ── Main Dashboard ─────────────────────────────────────────────────────

export const BusinessObservability = () => {
  const kpi = BUSINESS_KPIS;

  return (
    <Flex flexDirection="column" gap={16} padding={16}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <TitleBar>
        <TitleBar.Title>Business Observability</TitleBar.Title>
        <TitleBar.Subtitle>AI-powered business outcomes correlated with system health</TitleBar.Subtitle>
        <TitleBar.Suffix>
          <SampleDataBadge type="sample" tooltip="Simulated data for Jocata GRID FinTech platform demo" />
        </TitleBar.Suffix>
      </TitleBar>

      {/* ── Executive KPI Strip ───────────────────────────────────────── */}
      <Flex gap={12} flexWrap="wrap">
        <StatCard label="Loan Applications" value={formatNumber(kpi.loanApplications.today)} icon={<MoneyIcon />} color={STATUS.good} subtext={`${kpi.loanApplications.aiAssistedPct}% AI-assisted`} trend={{ direction: "up", value: "+8.3% vs yesterday", good: true }} />
        <StatCard label="Approval Rate" value={`${((kpi.loanApplications.approved / kpi.loanApplications.today) * 100).toFixed(1)}%`} icon={<CheckmarkIcon />} color={STATUS.ideal} subtext={`${formatNumber(kpi.loanApplications.approved)} approved`} trend={{ direction: "up", value: "+2.1%", good: true }} />
        <StatCard label="Avg Decision Time" value={`${kpi.loanApplications.avgDecisionTime}s`} icon={<ClockIcon />} color={kpi.loanApplications.avgDecisionTime <= kpi.loanApplications.slaTarget ? STATUS.ideal : STATUS.critical} subtext={`SLA: <${kpi.loanApplications.slaTarget}s (P95)`} trend={{ direction: "down", value: "−0.4s", good: true }} />
        <StatCard label="Fraud Blocked" value={`₹${(kpi.fraudDetection.blockedAmount / 100_000).toFixed(1)}L`} icon={<LockIcon />} color={STATUS.warning} subtext={`${kpi.fraudDetection.confirmed} confirmed cases`} trend={{ direction: "up", value: "+12.4%", good: true }} />
        <StatCard label="SLA Compliance" value={`${kpi.loanApplications.slaCompliance}%`} icon={<ServiceLevelObjectivesIcon />} color={STATUS.ideal} subtext="Target: 95%" />
        <StatCard label="KYC Auto-Pass" value={`${((kpi.kycVerifications.automated / kpi.kycVerifications.total) * 100).toFixed(1)}%`} icon={<AgentIcon />} color={STATUS.ideal} subtext={`${formatNumber(kpi.kycVerifications.automated)} / ${formatNumber(kpi.kycVerifications.total)}`} trend={{ direction: "up", value: "+1.8%", good: true }} />
      </Flex>

      <Tabs defaultIndex={0}>
        <Tab title="Business Impact">
          <Flex flexDirection="column" gap={16} style={{ marginTop: 16 }}>
          {/* ── Row 1: Loan Volume + Decision Latency ──────────────────── */}
          <Flex gap={16} flexWrap="wrap">
            <ChartCard title="Loan Application Volume (Hourly)">
              <TimeseriesChart data={loanVolumeTs} variant="area" />
            </ChartCard>
            <ChartCard title="AI Decision Latency vs SLA (seconds)">
              <TimeseriesChart data={decisionLatencyTs} variant="line" />
            </ChartCard>
          </Flex>

          {/* ── Row 2: Channel Distribution + Revenue Impact ────────────── */}
          <Flex gap={16} flexWrap="wrap">
            <ChartCard title="Applications by Channel">
              <DonutChart data={loanChannelDonut}>
                <DonutChart.Legend position="right" />
              </DonutChart>
            </ChartCard>
            <ChartCard title="Revenue Impact — AI Protection ($K)">
              <TimeseriesChart data={revenueImpactTs} variant="area" />
            </ChartCard>
          </Flex>

          {/* ── Row 3: Fraud Detection + AML ────────────────────────────── */}
          <SectionTitle title="Risk & Compliance Intelligence" subtitle="Real-time fraud detection and AML monitoring powered by AI models" />
          <Flex gap={16} flexWrap="wrap">
            <ChartCard title="Fraud Detection Pipeline (Hourly)">
              <TimeseriesChart data={fraudDetectionTs} variant="bar" />
            </ChartCard>
            <ChartCard title="AML Alert Processing">
              <TimeseriesChart data={amlAlertTs} variant="area" />
            </ChartCard>
          </Flex>

          {/* ── AML + Fraud Stats ────────────────────────────────────────── */}
          <Flex gap={12} flexWrap="wrap">
            <StatCard label="Transactions Scanned" value={`${(kpi.fraudDetection.scannedTransactions / 1_000_000).toFixed(2)}M`} icon={<DatabaseIcon />} subtext="Last 24 hours" />
            <StatCard label="False Positive Rate" value={`${kpi.fraudDetection.falsePositiveRate}%`} icon={<WarningIcon />} color={kpi.fraudDetection.falsePositiveRate < 5 ? STATUS.ideal : STATUS.warning} subtext="Target: <5%" />
            <StatCard label="AML Auto-Triage" value={`${((kpi.amlCompliance.aiTriaged / kpi.amlCompliance.alerts) * 100).toFixed(1)}%`} icon={<AiIcon />} color={STATUS.ideal} subtext={`FP reduced by ${kpi.amlCompliance.falsePositiveReduction}%`} />
            <StatCard label="Detection Latency" value={`${(kpi.fraudDetection.avgDetectionLatency * 1000).toFixed(0)}ms`} icon={<ClockIcon />} color={STATUS.ideal} subtext="Real-time streaming" />
          </Flex>
          </Flex>
        </Tab>

        <Tab title="AI Service Health">
          <Flex flexDirection="column" gap={16} style={{ marginTop: 16 }}>
          {/* ── AI Model Usage Distribution ───────────────────────────── */}
          <Flex gap={16} flexWrap="wrap">
            <ChartCard title="AI Model Allocation Across Business Functions">
              <DonutChart data={modelUsageDonut}>
                <DonutChart.Legend position="right" />
              </DonutChart>
            </ChartCard>
            <ChartCard title="eKYC Processing Pipeline (Hourly)">
              <TimeseriesChart data={kycProcessingTs} variant="area" />
            </ChartCard>
          </Flex>

          {/* ── Service Health Table ──────────────────────────────────── */}
          <SectionTitle title="AI Service Health Matrix" subtitle="All GenAI-powered services across the GRID platform" />
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <DataTable
              data={serviceHealthData}
              columns={[
                {
                  id: "status_indicator",
                  header: "",
                  accessor: "status",
                  cell: ({ value }) => <StatusDot status={value as string} />,
                  minWidth: 30,
                  maxWidth: 40,
                },
                { id: "service", header: "Service", accessor: "service", minWidth: 200 },
                { id: "provider", header: "Provider", accessor: "provider", minWidth: 130 },
                { id: "model", header: "Model", accessor: "model", minWidth: 140 },
                {
                  id: "latencyP95",
                  header: "Latency P95",
                  accessor: "latencyP95",
                  cell: ({ value }) => (
                    <Text style={{ color: (value as number) > 3.0 ? STATUS.critical : (value as number) > 2.5 ? STATUS.warning : STATUS.ideal }}>
                      {(value as number).toFixed(2)}s
                    </Text>
                  ),
                  minWidth: 100,
                },
                {
                  id: "errorRate",
                  header: "Error %",
                  accessor: "errorRate",
                  cell: ({ value }) => (
                    <Text style={{ color: (value as number) > 0.5 ? STATUS.critical : (value as number) > 0.2 ? STATUS.warning : STATUS.ideal }}>
                      {(value as number).toFixed(2)}%
                    </Text>
                  ),
                  minWidth: 80,
                },
                {
                  id: "throughput",
                  header: "Req/24h",
                  accessor: "throughput",
                  cell: ({ value }) => <Text>{formatNumber(value as number)}</Text>,
                  minWidth: 90,
                },
                {
                  id: "tokens24h",
                  header: "Tokens/24h",
                  accessor: "tokens24h",
                  cell: ({ value }) => <Text>{`${((value as number) / 1_000_000).toFixed(2)}M`}</Text>,
                  minWidth: 100,
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          </Surface>
          </Flex>
        </Tab>

        <Tab title="SLOs & Compliance">
          <Flex flexDirection="column" gap={16} style={{ marginTop: 16 }}>
          {/* ── SLO Table ───────────────────────────────────────────────── */}
          <SectionTitle title="Business SLO Dashboard" subtitle="AI service SLOs linked to banking operations and RBI compliance" />
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <DataTable
              data={sloData}
              columns={[
                {
                  id: "slo_status",
                  header: "",
                  accessor: "status",
                  cell: ({ value }) => (
                    <StatusDot status={value === "met" ? "healthy" : value === "at_risk" ? "warning" : "critical"} />
                  ),
                  minWidth: 30,
                  maxWidth: 40,
                },
                { id: "name", header: "SLO Name", accessor: "name", minWidth: 200 },
                { id: "target", header: "Target", accessor: "target", minWidth: 120 },
                {
                  id: "current",
                  header: "Current",
                  accessor: "current",
                  cell: ({ value, rowData }) => (
                    <Strong style={{ color: (rowData as { status: string }).status === "met" ? STATUS.ideal : STATUS.warning }}>
                      {value as string}
                    </Strong>
                  ),
                  minWidth: 100,
                },
                {
                  id: "burnRate",
                  header: "Burn Rate",
                  accessor: "burnRate",
                  cell: ({ value }) => (
                    <Flex alignItems="center" gap={6} style={{ width: 120 }}>
                      <ProgressBar 
                        value={(value as number) * 100} 
                        max={100} 
                        color={(value as number) > 0.7 ? "critical" : (value as number) > 0.4 ? "warning" : "success"} 
                        aria-label="burn rate"
                      />
                      <Text style={{ fontSize: 11 }}>{((value as number) * 100).toFixed(0)}%</Text>
                    </Flex>
                  ),
                  minWidth: 140,
                },
                {
                  id: "remaining",
                  header: "Error Budget Left",
                  accessor: "remaining",
                  minWidth: 120,
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          </Surface>

          {/* ── Compliance Summary ───────────────────────────────────────── */}
          <SectionTitle title="Regulatory Compliance Status" subtitle="Real-time compliance tracking for RBI, DPDP Act, and AML regulations" />
          <Flex gap={12} flexWrap="wrap">
            <Surface padding={16} style={{ borderRadius: 8, flex: 1, minWidth: 200 }}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={6}>
                  <LockIcon style={{ color: STATUS.ideal }} />
                  <Strong>RBI Digital Lending Guidelines</Strong>
                </Flex>
                <Flex alignItems="center" gap={8}>
                  <ProgressBar value={98} max={100} color="success" aria-label="RBI compliance" />
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>98%</Text>
                </Flex>
                <Text style={{ fontSize: 11, color: "var(--dt-colors-text-secondary-default)" }}>
                  All loan decisions auditable • Transaction traces retained 7 years
                </Text>
              </Flex>
            </Surface>
            <Surface padding={16} style={{ borderRadius: 8, flex: 1, minWidth: 200 }}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={6}>
                  <LockIcon style={{ color: STATUS.ideal }} />
                  <Strong>DPDP Act 2023 Compliance</Strong>
                </Flex>
                <Flex alignItems="center" gap={8}>
                  <ProgressBar value={96} max={100} color="success" aria-label="DPDP compliance" />
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>96%</Text>
                </Flex>
                <Text style={{ fontSize: 11, color: "var(--dt-colors-text-secondary-default)" }}>
                  PII masking active • Consent verification on all AI prompts
                </Text>
              </Flex>
            </Surface>
            <Surface padding={16} style={{ borderRadius: 8, flex: 1, minWidth: 200 }}>
              <Flex flexDirection="column" gap={8}>
                <Flex alignItems="center" gap={6}>
                  <LockIcon style={{ color: STATUS.warning }} />
                  <Strong>AML / PMLA Compliance</Strong>
                </Flex>
                <Flex alignItems="center" gap={8}>
                  <ProgressBar value={91} max={100} color="warning" aria-label="AML compliance" />
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>91%</Text>
                </Flex>
                <Text style={{ fontSize: 11, color: "var(--dt-colors-text-secondary-default)" }}>
                  {kpi.amlCompliance.regulatoryReportsFiled} STR reports filed • Model retraining recommended
                </Text>
              </Flex>
            </Surface>
          </Flex>
          </Flex>
        </Tab>

        <Tab title="AI Events Feed">
          <Flex flexDirection="column" gap={16} style={{ marginTop: 16 }}>
          {/* ── Recent AI-Correlated Events ─────────────────────────────── */}
          <SectionTitle title="AI-Correlated Business Events" subtitle="Davis AI auto-detection of business-impacting events with automated remediation" />
          <Surface padding={16} style={{ borderRadius: 8 }}>
            <DataTable
              data={recentEvents}
              columns={[
                {
                  id: "severity_dot",
                  header: "",
                  accessor: "severity",
                  cell: ({ value }) => (
                    <StatusDot status={value === "critical" ? "critical" : value === "warning" ? "warning" : "healthy"} />
                  ),
                  minWidth: 30,
                  maxWidth: 40,
                },
                {
                  id: "time",
                  header: "Time",
                  accessor: "time",
                  cell: ({ value }) => <Text style={{ fontFamily: "monospace", fontSize: 12 }}>{value as string}</Text>,
                  minWidth: 60,
                },
                { id: "event", header: "Event", accessor: "event", minWidth: 280 },
                { id: "service", header: "Service", accessor: "service", minWidth: 180 },
                {
                  id: "aiAction",
                  header: "Davis AI Action",
                  accessor: "aiAction",
                  cell: ({ value }) => (
                    <Flex alignItems="center" gap={4}>
                      <AiIcon style={{ width: 12, height: 12, color: CAT[0] }} />
                      <Text style={{ fontSize: 12 }}>{value as string}</Text>
                    </Flex>
                  ),
                  minWidth: 280,
                },
              ]}
            >
              <DataTable.Pagination defaultPageSize={10} />
            </DataTable>
          </Surface>

          {/* ── AI ROI Summary ───────────────────────────────────────────── */}
          <SectionTitle title="AI Investment ROI Summary" subtitle="Quantified business value from AI-powered automation (24h)" />
          <Flex gap={12} flexWrap="wrap">
            <StatCard label="Manual Reviews Eliminated" value="14,280" icon={<AgentIcon />} color={STATUS.ideal} subtext="93.2% automation rate" />
            <StatCard label="Analyst Hours Saved" value="847" icon={<ClockIcon />} color={STATUS.ideal} subtext="≈ ₹42.3L saved/day" />
            <StatCard label="Fraud Prevented" value="₹47.2L" icon={<LockIcon />} color={STATUS.warning} subtext="892 confirmed blocks" />
            <StatCard label="SLA Breaches Averted" value="23" icon={<ServiceLevelObjectivesIcon />} color={STATUS.ideal} subtext="Davis auto-scaling" />
            <StatCard label="Model Accuracy" value="97.8%" icon={<AiIcon />} color={STATUS.ideal} subtext="Across all 8 services" />
          </Flex>
          </Flex>
        </Tab>
      </Tabs>
    </Flex>
  );
};
