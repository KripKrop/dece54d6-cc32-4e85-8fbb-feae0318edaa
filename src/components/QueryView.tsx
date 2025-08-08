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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
interface QueryViewProps {
  selectedTable?: string;
  onSelectTable?: (t: string) => void;
}

const OPS: FilterOp[] = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "like",
  "in",
  "between",
  "in_range",
  "is_null",
  "is_not_null",
];

const NO_VALUE_OPS = new Set<FilterOp>(["is_null", "is_not_null"]);
const ARRAY_VALUE_OPS = new Set<FilterOp>(["in", "in_range"]);

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

  const coerceType = (v: string) => {
    const trimmed = v.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    const n = Number(trimmed);
    return Number.isNaN(n) ? trimmed : n;
  };

  const queryBody: QueryBody | undefined = useMemo(() => {
    if (!selectedTable) return undefined;
    const processed = filters
      .map((f) => {
        if (!f.column) return null;
        const op = f.op;
        if (NO_VALUE_OPS.has(op)) {
          return { column: f.column, op } as any;
        }
        const raw = (f.value ?? "").toString();
        if (op === "between") {
          const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
          if (parts.length !== 2) return null;
          return { column: f.column, op, value: parts.map(coerceType) } as any;
        }
        if (ARRAY_VALUE_OPS.has(op)) {
          const arr = raw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map(coerceType);
          if (!arr.length) return null;
          return { column: f.column, op, value: arr } as any;
        }
        if (!raw) return null;
        return { column: f.column, op, value: coerceType(raw) } as any;
      })
      .filter(Boolean) as any;
    return {
      filters: processed,
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
                  <ScrollArea className="max-h-24 rounded-md border">
                    <div className="flex flex-wrap gap-2 p-2">
                      {fields.map((f) => (
                        <button
                          key={f}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() => setFields((prev) => prev.filter((x) => x !== f))}
                          title="Remove column"
                        >
                          {f} ×
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
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
              {filters.map((f, idx) => {
                const [low, high] = (f.value || "").toString().split(",");
                return (
                  <div key={idx} className="grid gap-2 md:grid-cols-[1fr_160px_1fr_80px]">
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
                      onChange={(e) => setFilters((arr) => arr.map((it, i) => (i === idx ? { ...it, op: e.target.value as any, value: undefined } : it)))}
                    >
                      {OPS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    {f.op === "between" ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Low"
                          value={low ?? ""}
                          onChange={(e) =>
                            setFilters((arr) =>
                              arr.map((it, i) =>
                                i === idx ? { ...it, value: `${e.target.value},${high ?? ""}` } : it
                              )
                            )
                          }
                        />
                        <Input
                          placeholder="High"
                          value={high ?? ""}
                          onChange={(e) =>
                            setFilters((arr) =>
                              arr.map((it, i) =>
                                i === idx ? { ...it, value: `${low ?? ""},${e.target.value}` } : it
                              )
                            )
                          }
                        />
                      </div>
                    ) : NO_VALUE_OPS.has(f.op) ? (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No value</div>
                    ) : ARRAY_VALUE_OPS.has(f.op) ? (
                      <Input
                        placeholder="Comma-separated values"
                        value={(f.value as any) || ""}
                        onChange={(e) =>
                          setFilters((arr) =>
                            arr.map((it, i) => (i === idx ? { ...it, value: e.target.value } : it))
                          )
                        }
                      />
                    ) : (
                      <Input
                        placeholder="Value"
                        value={(f.value as any) || ""}
                        onChange={(e) =>
                          setFilters((arr) =>
                            arr.map((it, i) => (i === idx ? { ...it, value: e.target.value } : it))
                          )
                        }
                      />
                    )}
                    <Button variant="ghost" onClick={() => setFilters((arr) => arr.filter((_, i) => i !== idx))}>Remove</Button>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative">
        <CardContent className="pt-6">
        <div className="rounded-md border overflow-auto max-h-[520px]">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted/50">
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c} className="min-w-[160px]">{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className="animate-fade-in">
                  {columns.map((c) => (
                    <TableCell key={c} className="whitespace-pre-wrap break-words align-top">
                      {String(r?.[c] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={columns.length || 1} className="text-center text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
