import { useEffect, useRef } from "react";
import { useJobStore } from "../../store/jobStore";
import type { JobProgressMessage } from "../../api/types";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";

export function useJobSocket(jobId: string | null) {
  const applyProgressMessage = useJobStore((s) => s.applyProgressMessage);
  const setActiveJobId = useJobStore((s) => s.setActiveJobId);
  const setActiveStep = useJobStore((s) => s.setActiveStep);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const ws = new WebSocket(`${WS_URL}/ws/jobs/${jobId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: JobProgressMessage = JSON.parse(event.data);
        applyProgressMessage(msg);
        if (msg.status === "error") {
          setActiveJobId(null);
          setActiveStep("pipeline");
          ws.close();
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jobId, applyProgressMessage, setActiveJobId, setActiveStep]);

  return wsRef;
}
