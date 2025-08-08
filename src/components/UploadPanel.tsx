import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useConfigStore } from "@/store/config";
import { uploadFile } from "@/utils/api";
import { useUploadStatus } from "@/hooks/useUploadStatus";
import { toast } from "@/hooks/use-toast";

interface UploadPanelProps {
  onComplete?: (table?: string) => void;
}

export function UploadPanel({ onComplete }: UploadPanelProps) {
  const { apiBaseUrl, apiKey } = useConfigStore();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const status = useUploadStatus(jobId || undefined, apiBaseUrl);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const progress = status?.uploaded && status?.total ? Math.round((status.uploaded / status.total) * 100) : 0;
  const isProcessing = status?.status && ["processing", "processed", "completed"].includes(status.status);

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      const { job_id } = await uploadFile(apiBaseUrl, apiKey, file);
      setJobId(job_id);
      toast({ title: "Upload started", description: `Job ${job_id}` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" as any });
      setUploading(false);
    }
  };

  if (status?.status === "completed") {
    onComplete?.(status.table || undefined);
  }

  return (
    <section id="upload-panel" className="container mx-auto animate-fade-in">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Upload CSV/Excel</CardTitle>
          <CardDescription>Drag-and-drop your file or use the picker. Real-time status appears below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-md border border-dashed p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-sm text-muted-foreground mb-3">Drop file here or</p>
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>Choose file</Button>
            {file && <p className="mt-2 text-sm">Selected: {file.name}</p>}

            <div className="mt-4 flex justify-center">
              <Button disabled={!file || uploading} onClick={handleUpload}>Start upload</Button>
            </div>
          </div>

          {jobId && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Status: {status?.status || "waiting"}</span>
                {typeof progress === "number" && <span>{progress}%</span>}
              </div>
              <Progress value={progress} />
              {isProcessing && (
                <p className="text-sm text-muted-foreground">Processing rows: {status?.rows ?? 0}</p>
              )}
              {status?.error && (
                <p className="text-sm text-destructive">Error: {status.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
