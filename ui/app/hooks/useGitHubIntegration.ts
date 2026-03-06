/**
 * GitHub Integration Hook
 *
 * Uses DQL queries to discover GenAI-related issues, deployments, and PR activity
 * that correlate with observability data in Dynatrace. The MCP server handles
 * the actual GitHub API calls; this hook surfaces the data for the UI.
 *
 * Architecture:
 * - DQL queries discover deployment events, problem-to-issue correlations
 * - Workflow execution events track GitHub API interactions
 * - All data flows through Dynatrace Grail — no GitHub token in the UI
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { queryExecutionClient } from '@dynatrace-sdk/client-query';
import type {
  GitHubConfig,
  GitHubIssue,
  GitHubPullRequest,
  GitHubDeployment,
  GitHubRepoInfo,
} from '../types';

// ============================================
// DQL Queries
// ============================================

const GITHUB_WORKFLOW_EVENTS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "WORKFLOW_EXECUTION"
  | filter matchesPhrase(event.category, "github") OR matchesPhrase(dt.automation.action_type, "github")
  | summarize {
      total = count(),
      issues_created = countIf(dt.automation.github_action == "create_issue"),
      issues_closed = countIf(dt.automation.github_action == "close_issue"),
      prs_monitored = countIf(dt.automation.github_action == "monitor_pr"),
      deploys_tracked = countIf(dt.automation.github_action == "track_deploy")
    }
`;

const DEPLOYMENT_EVENTS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "CUSTOM_DEPLOYMENT"
  | fieldsAdd env = coalesce(dt.event.deployment.environment, "production"),
               ref_name = coalesce(dt.event.deployment.ref, "main"),
               sha = coalesce(dt.event.deployment.sha, ""),
               creator = coalesce(dt.event.deployment.creator, "system"),
               description = coalesce(event.name, "Deployment")
  | sort timestamp desc
  | limit 20
`;

const GENAI_ISSUES_FROM_PROBLEMS_QUERY = (timeframe: string) => `
  fetch events, from:now()-${timeframe}
  | filter event.type == "DAVIS_PROBLEM"
  | fieldsAdd title = event.name,
               severity = coalesce(event.status, "OPEN"),
               affected = coalesce(affected_entity_ids, ""),
               category = coalesce(event.category, "availability")
  | sort timestamp desc
  | limit 20
`;

const GENAI_ERROR_PATTERNS_QUERY = (timeframe: string) => `
  fetch spans, from:now()-${timeframe}
  | filter (isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model))
         AND (span.status_code == "error" OR isNotNull(error.type))
  | summarize {
      occurrences = count(),
      first_seen = min(timestamp),
      last_seen = max(timestamp),
      providers = collectDistinct(gen_ai.provider.name),
      models = collectDistinct(gen_ai.request.model)
    }, by: { error.type }
  | sort occurrences desc
  | limit 15
`;

// ============================================
// Hook State
// ============================================

interface GitHubState {
  config: GitHubConfig;
  issues: GitHubIssue[];
  pullRequests: GitHubPullRequest[];
  deployments: GitHubDeployment[];
  repoInfo: GitHubRepoInfo | null;
  workflowStats: { total: number; issuesCreated: number; issuesClosed: number; prsMonitored: number; deploysTracked: number };
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// ============================================
// Hook
// ============================================

export function useGitHubIntegration(timeframe = '24h') {
  const [state, setState] = useState<GitHubState>({
    config: {
      owner: '',
      repo: '',
      token: '',
      enabled: true,
      autoCreateIssues: true,
    },
    issues: [],
    pullRequests: [],
    deployments: [],
    repoInfo: null,
    workflowStats: { total: 0, issuesCreated: 0, issuesClosed: 0, prsMonitored: 0, deploysTracked: 0 },
    loading: false,
    error: null,
    lastRefresh: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchData = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const [wfRes, deployRes, problemRes, errorRes] = await Promise.all([
        queryExecutionClient.queryExecute({
          body: { query: GITHUB_WORKFLOW_EVENTS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: DEPLOYMENT_EVENTS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_ISSUES_FROM_PROBLEMS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
        queryExecutionClient.queryExecute({
          body: { query: GENAI_ERROR_PATTERNS_QUERY(timeframe), requestTimeoutMilliseconds: 60000, fetchTimeoutSeconds: 60 },
        }),
      ]);

      if (!mountedRef.current) return;

      // Workflow stats
      const wfRow = (wfRes.result?.records || [])[0];
      const workflowStats = wfRow ? {
        total: Number(wfRow['total'] || 0),
        issuesCreated: Number(wfRow['issues_created'] || 0),
        issuesClosed: Number(wfRow['issues_closed'] || 0),
        prsMonitored: Number(wfRow['prs_monitored'] || 0),
        deploysTracked: Number(wfRow['deploys_tracked'] || 0),
      } : { total: 0, issuesCreated: 0, issuesClosed: 0, prsMonitored: 0, deploysTracked: 0 };

      // Deployments from Dynatrace deployment events
      const deployments: GitHubDeployment[] = (deployRes.result?.records || []).map((r: any, idx: number) => ({
        id: idx + 1,
        environment: String(r['env'] || 'production'),
        ref: String(r['ref_name'] || 'main'),
        sha: String(r['sha'] || '').substring(0, 7),
        creator: String(r['creator'] || 'system'),
        createdAt: String(r['timestamp'] || new Date().toISOString()),
        description: String(r['description'] || 'Deployment'),
      }));

      // Issues — derived from Davis problems (would be created via MCP server)
      const issues: GitHubIssue[] = (problemRes.result?.records || []).map((r: any, idx: number) => ({
        number: idx + 1,
        title: `[AI] ${String(r['title'] || 'Davis Problem')}`,
        state: String(r['severity'] || 'OPEN') === 'CLOSED' ? 'closed' as const : 'open' as const,
        labels: ['ai-observability', String(r['category'] || 'availability')],
        assignees: [],
        createdAt: String(r['timestamp'] || new Date().toISOString()),
        updatedAt: String(r['timestamp'] || new Date().toISOString()),
        commentsCount: 0,
        url: '#',
      }));

      // Error patterns → potential issues
      const errorIssues: GitHubIssue[] = (errorRes.result?.records || []).map((r: any, idx: number) => ({
        number: 100 + idx,
        title: `[AI Error] ${String(r['error.type'] || 'Unknown Error')} — ${Number(r['occurrences'] || 0)} occurrences`,
        state: 'open' as const,
        labels: ['ai-error', 'auto-created'],
        assignees: [],
        createdAt: String(r['first_seen'] || new Date().toISOString()),
        updatedAt: String(r['last_seen'] || new Date().toISOString()),
        commentsCount: 0,
        url: '#',
      }));

      setState(s => ({
        ...s,
        deployments,
        issues: [...issues, ...errorIssues],
        workflowStats,
        loading: false,
        lastRefresh: new Date(),
      }));
    } catch (err) {
      if (mountedRef.current) {
        setState(s => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch GitHub integration data',
        }));
      }
    }
  }, [timeframe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    ...state,
    refresh: fetchData,
    openIssueCount: state.issues.filter(i => i.state === 'open').length,
    recentDeployCount: state.deployments.length,
  };
}

export default useGitHubIntegration;
