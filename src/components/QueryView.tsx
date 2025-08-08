import { useEffect, useMemo, useRef, useState } from "react";
import { useConfigStore } from "@/store/config";
import { getColumns, listTables, queryData, streamData, type FilterOp, type QueryBody } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";
import { FixedSizeList as List } from "react-window";

interface QueryViewProps {
  selectedTable?: string;
  onSelectTable?: (t: string) => void;
}

const OPS: FilterOp[] = ["eq", "neq", "lt", "lte", "gt", "gte", "contains"];

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay = 300) {
  const ref = useRef<number | undefined>();
  return (...args: Parameters<T>) => {
    if (ref.current) window.clearTimeout(ref.current);
    ref.current = window.setTimeout(() => fn(...args), delay);
  };
}

export function QueryView({ selectedTable, onSelectTable }: QueryViewProps) {
  const { apiBaseUrl, apiKey } = useConfigStore();

  const { data: tables } = useQuery({
    queryKey: ["tables", apiBaseUrl, apiKey],
    queryFn: () => listTables(apiBaseUrl, apiKey),
    enabled: !!apiBaseUrl,
  });

  const [fields, setFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ column?: string; op: FilterOp; value?: string }[]>([]);
  const [logical, setLogical] = useState<"AND" | "OR">("AND");
  const [orderBy, setOrderBy] = useState<{ column?: string; direction: "asc" | "desc" }>({ direction: "desc" });
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  const { data: cols } = useQuery({
    queryKey: ["columns", apiBaseUrl, apiKey, selectedTable],
    queryFn: () => getColumns(apiBaseUrl, apiKey, selectedTable!),
    enabled: !!selectedTable,
  });

  useEffect(() => {
    setFields([]);
    setFilters([]);
    setOffset(0);
  }, [selectedTable]);

  const queryBody: QueryBody | undefined = useMemo(() => {
    if (!selectedTable) return undefined;
    return {
      filters: filters.filter((f) => f.column && f.value !== undefined && f.value !== "") as any,
      logical_operator: logical,
      order_by: orderBy.column ? (orderBy as any) : undefined,
      limit,
      offset,
      fields: fields.length ? fields : undefined,
    };
  }, [selectedTable, filters, logical, orderBy, limit, offset, fields]);

  const { data: result, isFetching, refetch } = useQuery<{ rows: any[]; total: number }>({
    queryKey: ["query", apiBaseUrl, apiKey, selectedTable, queryBody],
    queryFn: () => queryData(apiBaseUrl, apiKey, selectedTable!, queryBody!),
    enabled: !!selectedTable && !!queryBody,
    placeholderData: (prev) => prev as any,
  });

  const debouncedRefetch = useDebouncedCallback(() => refetch(), 300);

  const runQuery = () => debouncedRefetch();

  const onExport = async () => {
    if (!selectedTable || !queryBody) return;
    try {
      const stream = await streamData(apiBaseUrl, apiKey, selectedTable, queryBody);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let lines = 0;
      const t = toast({ title: "Export started", description: "Streaming NDJSON…" });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          // rough line count
          lines += new TextDecoder().decode(value).split("\n").filter(Boolean).length;
          t.update?.({ title: "Exporting…", description: `${lines} lines` } as any);
        }
      }
      const blob = new Blob(chunks, { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedTable}-${Date.now()}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: `${lines} lines saved` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message, variant: "destructive" as any });
    }
  };

  // DataGrid (virtualized)
  const rows = result?.rows ?? [];
  const columns = useMemo(() => {
    if (fields.length) return fields;
    if (rows[0]) return Object.keys(rows[0]);
    return [] as string[];
  }, [fields, rows]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const r = rows[index];
    return (
      <div style={style} className="grid grid-cols-[repeat(var(--cols),minmax(120px,1fr))] border-b">
        {columns.map((c) => (
          <div key={c} className="px-3 py-2 text-sm hover:bg-muted/50">{String(r?.[c] ?? "")}</div>
        ))}
      </div>
    );
  };

  return (
    <section className="container mx-auto space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label>Table</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={selectedTable || ""}
                onChange={(e) => onSelectTable?.(e.target.value)}
              >
                <option value="">Select table…</option>
                {tables?.tables?.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Columns</Label>
              <Select onValueChange={(v) => setFields((prev) => (prev.includes(v) ? prev : [...prev, v]))}>
                <SelectTrigger>
                  <SelectValue placeholder="Add column…" />
                </SelectTrigger>
                <SelectContent>
                  {cols?.columns?.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fields.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fields.map((f) => (
                    <button
                      key={f}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => setFields((prev) => prev.filter((x) => x !== f))}
                    >
                      {f} ×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Sort</Label>
              <div className="flex gap-2">
                <select
                  className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
                  value={orderBy.column || ""}
                  onChange={(e) => setOrderBy((p) => ({ ...p, column: e.target.value }))}
                >
                  <option value="">None</option>
                  {cols?.columns?.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
                  value={orderBy.direction}
                  onChange={(e) => setOrderBy((p) => ({ ...p, direction: e.target.value as any }))}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Pagination</Label>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOffset((o) => Math.max(0, o - limit))}>Prev</Button>
                <Button variant="secondary" onClick={() => setOffset((o) => o + limit)}>Next</Button>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Filters</Label>
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={logical}
                  onChange={(e) => setLogical(e.target.value as any)}
                  title="Logical operator"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <Button variant="secondary" onClick={() => setFilters((f) => [...f, { op: "eq" } as any])}>Add row</Button>
                <Button onClick={runQuery}>
                  {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Run Query
                </Button>
                <Button variant="outline" onClick={onExport}>
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {filters.map((f, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_80px]">
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={f.column || ""}
                    onChange={(e) => setFilters((arr) => arr.map((it, i) => (i === idx ? { ...it, column: e.target.value } : it)))}
                  >
                    <option value="">Column…</option>
                    {cols?.columns?.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={f.op}
                    onChange={(e) => setFilters((arr) => arr.map((it, i) => (i === idx ? { ...it, op: e.target.value as any } : it)))}
                  >
                    {OPS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Value"
                    value={f.value || ""}
                    onChange={(e) => setFilters((arr) => arr.map((it, i) => (i === idx ? { ...it, value: e.target.value } : it)))}
                  />
                  <Button variant="ghost" onClick={() => setFilters((arr) => arr.filter((_, i) => i !== idx))}>Remove</Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative">
        <CardContent className="pt-6">
          <div className="overflow-auto rounded-md border">
            <div className="grid grid-cols-[repeat(var(--cols),minmax(120px,1fr))] bg-muted/50">
              {columns.map((c) => (
                <div key={c} className="px-3 py-2 text-sm font-medium">{c}</div>
              ))}
            </div>
            <div style={{ ['--cols' as any]: String(columns.length) }}>
              <List height={400} itemCount={rows.length} itemSize={36} width={"100%"}>
                {Row}
              </List>
            </div>
          </div>
          {isFetching && (
            <div className="absolute inset-0 grid place-items-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">Total rows: {result?.total ?? 0}</div>
        </CardContent>
      </Card>
    </section>
  );
}
