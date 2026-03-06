/**
 * GitHub MCP Integration — MCP Server Tools for GitHub repository & issue management
 *
 * Exposes GitHub capabilities as MCP tools:
 * - github_list_issues: List GitHub issues for a GenAI project repository
 * - github_create_issue: Create a new GitHub issue from a GenAI alert or incident
 * - github_list_pull_requests: List PRs for GenAI code changes
 * - github_get_repo_info: Get repository metadata for GenAI projects
 * - github_create_issue_from_alert: Auto-create an issue when GenAI alert conditions are met
 * - github_list_deployments: Track GitHub deployments of GenAI services
 *
 * Uses the GitHub REST API v3 with personal access token authentication.
 * Combines GitHub data with Dynatrace GenAI observability for cross-platform insights.
 */

import { executeDql } from "./dql-client.js";

// ─── Types ────────────────────────────────────────────

export interface GitHubToolResult {
  success: boolean;
  toolName: string;
  summary: string;
  data: any;
  dql?: string;
  executionTimeMs: number;
}

interface GitHubToolDef {
  name: string;
  description: string;
  execute: (params: Record<string, string>) => Promise<GitHubToolResult>;
}

const GITHUB_API_BASE = "https://api.github.com";

// ─── GitHub API Caller ────────────────────────────────

async function callGitHubAPI(
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  token?: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const accessToken = token || process.env.GITHUB_TOKEN || "";

  if (!accessToken) {
    return { ok: false, error: "GITHUB_TOKEN environment variable is required" };
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (body) headers["Content-Type"] = "application/json";

    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 300)}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── MCP Tool Definitions ─────────────────────────────

/**
 * github_list_issues — List GitHub issues for a GenAI project
 */
const githubListIssues: GitHubToolDef = {
  name: "github_list_issues",
  description:
    "List GitHub issues for a GenAI project repository. Supports filtering by state, labels, and assignee.",
  execute: async (params) => {
    const start = Date.now();
    const owner = params.owner || params.org || process.env.GITHUB_OWNER || "";
    const repo = params.repo || params.repository || process.env.GITHUB_REPO || "";
    const state = params.state || "open";
    const labels = params.labels || "";
    const perPage = params.per_page || "30";

    if (!owner || !repo) {
      return {
        success: false,
        toolName: "github_list_issues",
        summary: "Missing owner or repo parameter",
        data: { error: "owner and repo are required (or set GITHUB_OWNER/GITHUB_REPO env vars)" },
        executionTimeMs: Date.now() - start,
      };
    }

    let path = `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}`;
    if (labels) path += `&labels=${encodeURIComponent(labels)}`;

    const result = await callGitHubAPI(path, "GET", undefined, params.token);

    if (result.ok) {
      const issues = (result.data || []).map((i: any) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        labels: (i.labels || []).map((l: any) => l.name),
        assignees: (i.assignees || []).map((a: any) => a.login),
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        commentsCount: i.comments,
        url: i.html_url,
        isPullRequest: !!i.pull_request,
      }));

      // Filter out PRs (GitHub API returns PRs as issues)
      const issuesOnly = issues.filter((i: any) => !i.isPullRequest);

      return {
        success: true,
        toolName: "github_list_issues",
        summary: `${issuesOnly.length} issue(s) in ${owner}/${repo} (${state})`,
        data: { issues: issuesOnly, owner, repo, state, source: "github" },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "github_list_issues",
      summary: `Failed to list issues: ${result.error}`,
      data: { error: result.error, owner, repo },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * github_create_issue — Create a new GitHub issue
 */
const githubCreateIssue: GitHubToolDef = {
  name: "github_create_issue",
  description:
    "Create a new GitHub issue in a GenAI project repository. Can be used to track GenAI incidents, bugs, or improvement requests.",
  execute: async (params) => {
    const start = Date.now();
    const owner = params.owner || process.env.GITHUB_OWNER || "";
    const repo = params.repo || process.env.GITHUB_REPO || "";
    const title = params.title || "GenAI Control Center Issue";
    const body = params.body || params.description || "";
    const labels = (params.labels || "genai,auto-created").split(",").map((l) => l.trim());
    const assignees = params.assignees ? params.assignees.split(",").map((a) => a.trim()) : [];

    if (!owner || !repo) {
      return {
        success: false,
        toolName: "github_create_issue",
        summary: "Missing owner or repo",
        data: { error: "owner and repo are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const result = await callGitHubAPI(
      `/repos/${owner}/${repo}/issues`,
      "POST",
      { title, body, labels, assignees },
      params.token
    );

    return {
      success: result.ok,
      toolName: "github_create_issue",
      summary: result.ok
        ? `Issue #${result.data?.number} created: "${title}"`
        : `Failed: ${result.error}`,
      data: {
        issueNumber: result.data?.number,
        url: result.data?.html_url,
        title,
        labels,
        created: result.ok,
        error: result.error,
      },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * github_list_pull_requests — List PRs for GenAI code changes
 */
const githubListPullRequests: GitHubToolDef = {
  name: "github_list_pull_requests",
  description:
    "List pull requests for a GenAI project. Useful for tracking model config changes, prompt updates, and infrastructure modifications.",
  execute: async (params) => {
    const start = Date.now();
    const owner = params.owner || process.env.GITHUB_OWNER || "";
    const repo = params.repo || process.env.GITHUB_REPO || "";
    const state = params.state || "open";
    const perPage = params.per_page || "30";

    if (!owner || !repo) {
      return {
        success: false,
        toolName: "github_list_pull_requests",
        summary: "Missing owner or repo",
        data: { error: "owner and repo are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const result = await callGitHubAPI(
      `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}`,
      "GET",
      undefined,
      params.token
    );

    if (result.ok) {
      const prs = (result.data || []).map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login,
        branch: pr.head?.ref,
        base: pr.base?.ref,
        draft: pr.draft,
        mergeable: pr.mergeable,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        reviewComments: pr.review_comments,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        url: pr.html_url,
      }));

      return {
        success: true,
        toolName: "github_list_pull_requests",
        summary: `${prs.length} PR(s) in ${owner}/${repo} (${state})`,
        data: { pullRequests: prs, owner, repo, state, source: "github" },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "github_list_pull_requests",
      summary: `Failed: ${result.error}`,
      data: { error: result.error },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * github_get_repo_info — Get repository metadata
 */
const githubGetRepoInfo: GitHubToolDef = {
  name: "github_get_repo_info",
  description:
    "Get GitHub repository info for a GenAI project. Shows stars, forks, language, open issues count, and recent activity.",
  execute: async (params) => {
    const start = Date.now();
    const owner = params.owner || process.env.GITHUB_OWNER || "";
    const repo = params.repo || process.env.GITHUB_REPO || "";

    if (!owner || !repo) {
      return {
        success: false,
        toolName: "github_get_repo_info",
        summary: "Missing owner or repo",
        data: { error: "owner and repo are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    const result = await callGitHubAPI(
      `/repos/${owner}/${repo}`,
      "GET",
      undefined,
      params.token
    );

    if (result.ok) {
      const r = result.data;
      return {
        success: true,
        toolName: "github_get_repo_info",
        summary: `${owner}/${repo}: ${r.stargazers_count} stars, ${r.open_issues_count} open issues`,
        data: {
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          forks: r.forks_count,
          openIssues: r.open_issues_count,
          watchers: r.watchers_count,
          defaultBranch: r.default_branch,
          visibility: r.visibility,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          pushedAt: r.pushed_at,
          topics: r.topics,
          url: r.html_url,
          source: "github",
        },
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "github_get_repo_info",
      summary: `Failed: ${result.error}`,
      data: { error: result.error },
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * github_create_issue_from_alert — Auto-create issue from GenAI alert conditions
 */
const githubCreateIssueFromAlert: GitHubToolDef = {
  name: "github_create_issue_from_alert",
  description:
    "Check GenAI alert conditions in Dynatrace and automatically create GitHub issues for any triggered alerts. Combines observability with issue tracking.",
  execute: async (params) => {
    const start = Date.now();
    const owner = params.owner || process.env.GITHUB_OWNER || "";
    const repo = params.repo || process.env.GITHUB_REPO || "";
    const timeframe = params.timeframe || "15m";
    const errorThreshold = parseFloat(params.error_threshold || "5");
    const latencyThreshold = parseFloat(params.latency_threshold_ms || "3000");

    if (!owner || !repo) {
      return {
        success: false,
        toolName: "github_create_issue_from_alert",
        summary: "Missing owner or repo",
        data: { error: "owner and repo are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    // Check GenAI conditions
    const dql = `fetch spans, from:now()-${timeframe}
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
| summarize {
    total_requests = count(),
    error_count = countIf(span.status_code == "error" OR isNotNull(error.type)),
    error_rate = toDouble(countIf(span.status_code == "error" OR isNotNull(error.type))) / toDouble(count()) * 100.0,
    avg_latency_ms = avg(duration) / 1000000,
    p95_latency_ms = percentile(duration, 95) / 1000000
  }, by: { gen_ai.provider.name, gen_ai.request.model }
| filter error_rate > ${errorThreshold} OR avg_latency_ms > ${latencyThreshold}`;

    const records = await executeDql(dql);
    const issuesCreated: any[] = [];

    for (const r of records) {
      const provider = r["gen_ai.provider.name"] || "unknown";
      const model = r["gen_ai.request.model"] || "unknown";
      const errorRate = Number(r.error_rate || 0);
      const avgLatency = Number(r.avg_latency_ms || 0);

      const issueTitle = `[GenAI Alert] ${provider}/${model} — ${errorRate > errorThreshold ? `Error Rate ${errorRate.toFixed(1)}%` : `Latency ${avgLatency.toFixed(0)}ms`}`;

      const issueBody = [
        `## GenAI Alert — Auto-Created`,
        ``,
        `**Provider:** ${provider}`,
        `**Model:** ${model}`,
        `**Time Window:** ${timeframe}`,
        `**Total Requests:** ${r.total_requests}`,
        `**Error Rate:** ${errorRate.toFixed(1)}% (threshold: ${errorThreshold}%)`,
        `**Avg Latency:** ${avgLatency.toFixed(0)}ms (threshold: ${latencyThreshold}ms)`,
        `**P95 Latency:** ${Number(r.p95_latency_ms || 0).toFixed(0)}ms`,
        ``,
        `---`,
        `*Auto-created by GenAI Control Center MCP Server at ${new Date().toISOString()}*`,
      ].join("\n");

      const severity = errorRate > 10 ? "critical" : errorRate > errorThreshold ? "warning" : "alert";
      const labels = ["genai", "auto-alert", severity];

      const createResult = await callGitHubAPI(
        `/repos/${owner}/${repo}/issues`,
        "POST",
        { title: issueTitle, body: issueBody, labels },
        params.token
      );

      issuesCreated.push({
        provider,
        model,
        errorRate,
        avgLatencyMs: avgLatency,
        issueCreated: createResult.ok,
        issueNumber: createResult.data?.number,
        issueUrl: createResult.data?.html_url,
        error: createResult.error,
      });
    }

    return {
      success: true,
      toolName: "github_create_issue_from_alert",
      summary: `${issuesCreated.length} alert(s) detected, ${issuesCreated.filter((i) => i.issueCreated).length} issue(s) created in ${owner}/${repo}`,
      data: { issuesCreated, owner, repo, thresholds: { errorThreshold, latencyThreshold } },
      dql,
      executionTimeMs: Date.now() - start,
    };
  },
};

/**
 * github_list_deployments — Track GitHub deployments of GenAI services
 */
const githubListDeployments: GitHubToolDef = {
  name: "github_list_deployments",
  description:
    "List GitHub deployments for a GenAI project. Useful for correlating code changes with GenAI performance shifts.",
  execute: async (params) => {
    const start = Date.now();
    const owner = params.owner || process.env.GITHUB_OWNER || "";
    const repo = params.repo || process.env.GITHUB_REPO || "";
    const environment = params.environment || "";
    const perPage = params.per_page || "20";

    if (!owner || !repo) {
      return {
        success: false,
        toolName: "github_list_deployments",
        summary: "Missing owner or repo",
        data: { error: "owner and repo are required" },
        executionTimeMs: Date.now() - start,
      };
    }

    let path = `/repos/${owner}/${repo}/deployments?per_page=${perPage}`;
    if (environment) path += `&environment=${encodeURIComponent(environment)}`;

    const result = await callGitHubAPI(path, "GET", undefined, params.token);

    if (result.ok) {
      const deployments = (result.data || []).map((d: any) => ({
        id: d.id,
        environment: d.environment,
        ref: d.ref,
        sha: d.sha?.slice(0, 7),
        task: d.task,
        description: d.description,
        creator: d.creator?.login,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        url: d.url,
      }));

      // Correlate with Dynatrace deployment events
      const dql = `fetch events, from:now()-7d
| filter event.type == "CUSTOM_DEPLOYMENT"
| fields timestamp, event.name, dt.entity.name, event.status
| sort timestamp desc
| limit 20`;

      const dtDeployments = await executeDql(dql);

      return {
        success: true,
        toolName: "github_list_deployments",
        summary: `${deployments.length} GitHub deployment(s), ${dtDeployments.length} Dynatrace deployment event(s)`,
        data: {
          githubDeployments: deployments,
          dynatraceDeployments: dtDeployments,
          owner,
          repo,
          source: "github+dynatrace",
        },
        dql,
        executionTimeMs: Date.now() - start,
      };
    }

    return {
      success: false,
      toolName: "github_list_deployments",
      summary: `Failed: ${result.error}`,
      data: { error: result.error },
      executionTimeMs: Date.now() - start,
    };
  },
};

// ─── Export all GitHub MCP tools ──────────────────────

export const GITHUB_MCP_TOOLS: GitHubToolDef[] = [
  githubListIssues,
  githubCreateIssue,
  githubListPullRequests,
  githubGetRepoInfo,
  githubCreateIssueFromAlert,
  githubListDeployments,
];
