/**
 * DQL Client — Execute DQL queries against Dynatrace via REST API
 *
 * Requires environment variables:
 *   DT_ENVIRONMENT_URL — e.g. https://{id}.apps.dynatrace.com
 *   DT_API_TOKEN       — API token with storage:events:read, etc.
 */

const DT_ENV_URL = process.env.DT_ENVIRONMENT_URL || "";
const DT_API_TOKEN = process.env.DT_API_TOKEN || "";

interface DqlResult {
  records: any[];
  error?: string;
}

/**
 * Execute a DQL query against the Dynatrace Grail data lakehouse.
 * Returns an array of records, or [] on failure.
 */
export async function executeDql(query: string): Promise<any[]> {
  if (!DT_ENV_URL || !DT_API_TOKEN) {
    console.error("[DQL] Missing DT_ENVIRONMENT_URL or DT_API_TOKEN");
    return [];
  }

  const baseUrl = DT_ENV_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/platform/storage/query/v1/query:execute`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Api-Token ${DT_API_TOKEN}`,
      },
      body: JSON.stringify({
        query,
        requestTimeoutMilliseconds: 60000,
        fetchTimeoutSeconds: 60,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[DQL] HTTP ${response.status}: ${text.slice(0, 300)}`);
      return [];
    }

    const data = (await response.json()) as DqlResult;
    return data.records || [];
  } catch (err) {
    console.error("[DQL] Query failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Format number with locale */
export function fmt(n: number, decimals = 0): string {
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: decimals })
    : "—";
}

/** Format nanoseconds to ms */
export function nsToMs(ns: number): string {
  return fmt(ns / 1_000_000, 0);
}
