import React, { useMemo, useRef } from "react";
import { TableVirtuoso, TableComponents } from "react-virtuoso";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataGridProps {
  columns: string[];
  rows: any[];
  height?: number;
}

// Estimate column width based on header + sample content lengths
function useColumnWidths(columns: string[], rows: any[]) {
  return useMemo(() => {
    const sampleCount = Math.min(100, rows.length);
    const charPx = 8; // approximate width per character for text-sm
    const min = 140;
    const max = 420;
    const widths = columns.map((c) => {
      let maxLen = (c ?? "").toString().length;
      for (let i = 0; i < sampleCount; i++) {
        const val = rows[i]?.[c];
        const len = (val == null ? "" : String(val)).length;
        if (len > maxLen) maxLen = len;
      }
      const px = Math.min(max, Math.max(min, maxLen * charPx * 0.7));
      return Math.round(px);
    });
    return widths;
  }, [columns, rows]);
}

export function DataGrid({ columns, rows, height = 520 }: DataGridProps) {
  const colWidths = useColumnWidths(columns, rows);
  const totalWidth = useMemo(() => colWidths.reduce((a, b) => a + b, 0), [colWidths]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const components: TableComponents<any> = {
    Scroller: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ style, ...props }, ref) => (
        <div
          ref={(node) => {
            if (typeof ref === "function") ref(node as any);
            else if (ref && typeof (ref as any) === "object") (ref as any).current = node;
            scrollerRef.current = node;
          }}
          style={{ ...style, height }}
          className="rounded-md border overflow-auto"
          {...props}
        />
      )
    ),
    Table: (props) => (
      <table
        {...props}
        style={{ ...(props as any).style, width: totalWidth }}
        className="w-full caption-bottom text-sm table-fixed"
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        {props.children}
      </table>
    ),
    TableHead: (props) => (
      <TableHeader
        {...props}
        className="sticky top-0 z-10 bg-muted"
      />
    ),
    TableRow: React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>((props, ref) => (
      <TableRow ref={ref} {...props} />
    )),
    TableBody: React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>((props, ref) => (
      <TableBody ref={ref} {...props} />
    )),
    TableFoot: undefined as any,
  };

  return (
    <div className="relative">
      <TableVirtuoso
        data={rows}
        fixedHeaderContent={() => (
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="align-middle font-medium text-muted-foreground">
                {c}
              </TableHead>
            ))}
          </TableRow>
        )}
        components={components}
        itemContent={(index) => (
          <>
            {columns.map((c) => (
              <TableCell key={c} className="whitespace-pre-wrap break-words align-top text-sm" dir="auto">
                {String(rows[index]?.[c] ?? "")}
              </TableCell>
            ))}
          </>
        )}
        style={{ height }}
      />
    </div>
  );
}

export default DataGrid;
