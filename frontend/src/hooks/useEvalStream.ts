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
  const isFinishedRef = useRef(false);

  useEffect(() => {
    if (!evalId) return;
    isFinishedRef.current = false;

    const url = `/api/eval/${evalId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    const finishWithScorecard = (scorecard: ExecutiveScorecardReport) => {
      if (isFinishedRef.current) return;
      isFinishedRef.current = true;
      setState((prev) => ({
        ...prev,
        progressPercent: 100,
        completedSamples: prev.totalSamples || prev.completedSamples,
        isCompleted: true,
        scorecard,
        logs: prev.logs.some((l) => l.includes('[COMPLETE]'))
          ? prev.logs
          : [...prev.logs, '[COMPLETE] Evaluation run completed successfully.'],
      }));
      es.close();
    };

    es.addEventListener('eval_started', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          totalSamples: data.total_samples || prev.totalSamples,
          progressPercent: Math.max(prev.progressPercent, 5),
          logs: [...prev.logs, `[START] Evaluation started for ${data.task_name} (${data.total_samples} samples)`],
        }));
      } catch (err) {
        console.warn('Failed to parse eval_started event:', err);
      }
    });

    es.addEventListener('log_chunk', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, data.log_message],
          progressPercent:
            typeof data.progress_percent === 'number'
              ? data.progress_percent
              : prev.progressPercent,
          completedSamples:
            typeof data.completed_samples === 'number'
              ? data.completed_samples
              : prev.completedSamples,
          totalSamples:
            typeof data.total_samples === 'number' && data.total_samples > 0
              ? data.total_samples
              : prev.totalSamples,
          currentSampleId: data.current_sample_id || prev.currentSampleId,
          currentCategory: data.current_category || prev.currentCategory,
        }));
      } catch (err) {
        console.warn('Failed to parse log_chunk event:', err);
      }
    });

    es.addEventListener('eval_complete', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.scorecard) {
          finishWithScorecard(data.scorecard);
        }
      } catch (err) {
        console.warn('Failed to parse eval_complete event:', err);
      }
    });

    es.addEventListener('eval_error', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        isFinishedRef.current = true;
        setState((prev) => ({
          ...prev,
          error: data.error || 'Evaluation error occurred',
          logs: [...prev.logs, `[ERROR] ${data.error}`],
        }));
        es.close();
      } catch (err) {
        console.warn('Failed to parse eval_error event:', err);
      }
    });

    es.onerror = () => {
      // Do not abruptly terminate on SSE blips; let polling safety net check status
    };

    // Resilient Polling Safety Net: Checks status in case SSE connection closes or stalls
    const pollInterval = setInterval(async () => {
      if (isFinishedRef.current) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const statusRes = await fetch(`/api/eval/${evalId}/status`);
        if (!statusRes.ok) return;
        const statusData = await statusRes.json();

        if (statusData.has_scorecard) {
          const scorecardRes = await fetch(`/api/scorecard/${evalId}`);
          if (scorecardRes.ok) {
            const scorecard = await scorecardRes.json();
            finishWithScorecard(scorecard);
            clearInterval(pollInterval);
          }
        } else if (statusData.status === 'error') {
          isFinishedRef.current = true;
          setState((prev) => ({
            ...prev,
            error: 'Evaluation execution encountered an error.',
            logs: [...prev.logs, '[ERROR] Subprocess evaluation failed.'],
          }));
          es.close();
          clearInterval(pollInterval);
        }
      } catch (pollErr) {
        // Silently continue polling
      }
    }, 1500);

    return () => {
      clearInterval(pollInterval);
      es.close();
    };
  }, [evalId]);

  return state;
}
