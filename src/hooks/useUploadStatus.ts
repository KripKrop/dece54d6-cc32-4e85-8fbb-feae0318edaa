import { useEffect, useRef, useState } from "react";

interface StatusMsg {
  status: string;
  uploaded?: number;
  total?: number;
  rows?: number;
  table?: string;
  error?: string | null;
}

export function useUploadStatus(jobId?: string, apiBaseUrl?: string) {
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!jobId || !apiBaseUrl) return;
    const host = apiBaseUrl.replace(/^https?:\/\//, "");
    const url = `ws://${host}/ws/status/${jobId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as StatusMsg;
        setStatus(data);
      } catch (err) {
        console.error("WS parse error", err);
      }
    };
    ws.onerror = (e) => console.error("WS error", e);

    return () => ws.close();
  }, [jobId, apiBaseUrl]);

  return status;
}
