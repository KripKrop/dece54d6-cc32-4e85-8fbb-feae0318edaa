export type FilterOp =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "like"
  | "in"
  | "between"
  | "in_range"
  | "is_null"
  | "is_not_null";

export interface QueryBody {
  filters: { column: string; op: FilterOp; value: any }[];
  logical_operator: "AND" | "OR";
  order_by?: { column: string; direction: "asc" | "desc" };
  limit: number;
  offset: number;
  fields?: string[];
}

function headers(apiKey?: string) {
  const h: Record<string, string> = {};
  if (apiKey) h["x-api-key"] = apiKey;
  return h;
}

export async function uploadFile(apiBaseUrl: string, apiKey: string | undefined, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${apiBaseUrl}/upload`, {
    method: "POST",
    headers: headers(apiKey),
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json();
  return data as { job_id: string };
}

export async function listTables(apiBaseUrl: string, apiKey?: string) {
  const res = await fetch(`${apiBaseUrl}/tables`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`Tables fetch failed (${res.status})`);
  return (await res.json()) as { tables: string[] };
}

export async function getColumns(apiBaseUrl: string, apiKey: string | undefined, table: string) {
  const res = await fetch(`${apiBaseUrl}/tables/${encodeURIComponent(table)}/columns`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`Columns fetch failed (${res.status})`);
  return (await res.json()) as { columns: string[] };
}

export async function queryData(
  apiBaseUrl: string,
  apiKey: string | undefined,
  table: string,
  body: QueryBody
) {
  const res = await fetch(`${apiBaseUrl}/tables/${encodeURIComponent(table)}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers(apiKey) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Query failed (${res.status})`);
  return (await res.json()) as { rows: any[]; total: number };
}

export async function streamData(
  apiBaseUrl: string,
  apiKey: string | undefined,
  table: string,
  body: QueryBody
) {
  const res = await fetch(`${apiBaseUrl}/tables/${encodeURIComponent(table)}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers(apiKey) },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);
  return res.body; // ReadableStream<Uint8Array>
}
