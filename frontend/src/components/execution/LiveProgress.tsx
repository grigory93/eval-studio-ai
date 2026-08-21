import React, { useEffect, useRef } from 'react';
import { Activity, CheckCircle2, AlertCircle, ArrowRight, Terminal, ShieldCheck, XOctagon } from 'lucide-react';
import { useEvalStream } from '../../hooks/useEvalStream';
import { ExecutiveScorecardReport } from '../../types';

interface LiveProgressProps {
  evalId: string;
  taskName: string;
  onEvaluationCompleted: (scorecard: ExecutiveScorecardReport) => void;
  onCancel: () => void;
}

export const LiveProgress: React.FC<LiveProgressProps> = ({
  evalId,
  taskName,
  onEvaluationCompleted,
  onCancel,
}) => {
  const {
    progressPercent,
    completedSamples,
    totalSamples,
    logs,
    isCompleted,
    scorecard,
    error,
  } = useEvalStream(evalId);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (isCompleted && scorecard) {
      onEvaluationCompleted(scorecard);
    }
  }, [isCompleted, scorecard, onEvaluationCompleted]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-1">
            <Activity className="w-3.5 h-3.5 animate-spin" />
            Step 5: Live Execution & Sandboxed Evaluation
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
            Executing {taskName}
          </h2>
          <p className="text-xs text-slate-400">
            Running Inspect AI harness in isolated subprocess worker with real-time ADC model evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isCompleted && !error && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <XOctagon className="w-3.5 h-3.5" />
              Cancel Run
            </button>
          )}

          {isCompleted && scorecard && (
            <button
              type="button"
              onClick={() => onEvaluationCompleted(scorecard)}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              View Executive Scorecard
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
              {progressPercent}%
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {isCompleted ? 'Evaluation Finished' : 'Evaluating Test Samples...'}
              </h3>
              <p className="text-xs text-slate-400">
                {completedSamples} of {totalSamples || '–'} samples evaluated
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Process Isolation Active</span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              error
                ? 'bg-rose-500'
                : isCompleted
                ? 'bg-emerald-500'
                : 'bg-sky-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl flex items-start gap-3 text-rose-200 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Evaluation Execution Error</p>
            <p className="mt-0.5 text-rose-300">{error}</p>
          </div>
        </div>
      )}

      {/* Live Terminal Log Stream */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>Live Worker Subprocess Log Stream</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {evalId}
          </span>
        </div>

        <div className="p-4 font-mono text-xs text-slate-300 space-y-1.5 h-72 overflow-y-auto bg-slate-950/90">
          {logs.length === 0 ? (
            <p className="text-slate-600 italic">Waiting for worker output...</p>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`leading-relaxed ${
                  log.includes('[ERROR]') || log.includes('FAILED')
                    ? 'text-rose-400'
                    : log.includes('[COMPLETE]') || log.includes('PASSED')
                    ? 'text-emerald-400'
                    : log.includes('[START]')
                    ? 'text-sky-400'
                    : 'text-slate-400'
                }`}
              >
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Completion Banner */}
      {isCompleted && scorecard && (
        <div className="p-6 bg-emerald-950/30 border border-emerald-800/60 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Evaluation Run Complete</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Pass Rate: <span className="font-semibold text-emerald-400">{Math.round(scorecard.metrics.overall_pass_rate * 100)}%</span> across {scorecard.metrics.total_samples} samples with {scorecard.failure_clusters.length} diagnostic failure clusters.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEvaluationCompleted(scorecard)}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg flex items-center gap-2"
          >
            Open Scorecard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
