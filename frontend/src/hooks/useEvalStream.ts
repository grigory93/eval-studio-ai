import { useState, useEffect, useRef } from 'react';
import { ExecutiveScorecardReport } from '../types';

export interface EvalStreamState {
  progressPercent: number;
  completedSamples: number;
  totalSamples: number;
  currentSampleId: string;
  currentCategory: string;
  logs: string[];
  isCompleted: boolean;
  scorecard: ExecutiveScorecardReport | null;
  error: string | null;
}

export function useEvalStream(evalId: string | null) {
  const [state, setState] = useState<EvalStreamState>({
    progressPercent: 0,
    completedSamples: 0,
    totalSamples: 0,
    currentSampleId: '',
    currentCategory: '',
    logs: [],
    isCompleted: false,
    scorecard: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!evalId) return;

    const url = `/api/eval/${evalId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('eval_started', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        totalSamples: data.total_samples || 0,
        logs: [...prev.logs, `[START] Evaluation started for ${data.task_name} (${data.total_samples} samples)`],
      }));
    });

    es.addEventListener('log_chunk', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, data.log_message],
        progressPercent: data.progress_percent || prev.progressPercent,
        completedSamples: data.completed_samples || prev.completedSamples,
        totalSamples: data.total_samples || prev.totalSamples,
      }));
    });

    es.addEventListener('eval_complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        progressPercent: 100,
        isCompleted: true,
        scorecard: data.scorecard,
        logs: [...prev.logs, '[COMPLETE] Evaluation run completed successfully.'],
      }));
      es.close();
    });

    es.addEventListener('eval_error', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setState((prev) => ({
        ...prev,
        error: data.error || 'Evaluation error occurred',
        logs: [...prev.logs, `[ERROR] ${data.error}`],
      }));
      es.close();
    });

    es.onerror = () => {
      // Stream closed or error
      es.close();
    };

    return () => {
      es.close();
    };
  }, [evalId]);

  return state;
}
