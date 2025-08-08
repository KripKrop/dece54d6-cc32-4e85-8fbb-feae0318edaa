import { useState } from "react";
import { Settings, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfigStore } from "@/store/config";
import { useQuery } from "@tanstack/react-query";
import { listTables } from "@/utils/api";

interface NavbarProps {
  selectedTable?: string;
  onSelectTable?: (t: string) => void;
}

export function Navbar({ selectedTable, onSelectTable }: NavbarProps) {
  const { apiBaseUrl, apiKey, setApiBaseUrl, setApiKey } = useConfigStore();
  const [open, setOpen] = useState(false);

  const { data: tables } = useQuery({
    queryKey: ["tables", apiBaseUrl, apiKey],
    queryFn: () => listTables(apiBaseUrl, apiKey),
    enabled: !!apiBaseUrl,
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md" style={{ background: "var(--gradient-primary)" }} />
          <span className="text-lg font-semibold">Crunchy Analytics</span>
        </div>

        <div className="flex items-center gap-3">
          {tables?.tables && onSelectTable && (
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={selectedTable || ""}
              onChange={(e) => onSelectTable(e.target.value)}
            >
              <option value="">Select table…</option>
              {tables.tables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Backend configuration</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="api-base">API Base URL</Label>
                  <Input
                    id="api-base"
                    placeholder="https://your-backend.com"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="api-key">API Key (x-api-key)</Label>
                  <Input
                    id="api-key"
                    placeholder="optional"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button size="sm" onClick={() => document.getElementById("upload-panel")?.scrollIntoView({ behavior: "smooth" })}>
            <Upload className="mr-2 h-4 w-4" /> Upload
          </Button>
        </div>
      </div>
    </header>
  );
}
