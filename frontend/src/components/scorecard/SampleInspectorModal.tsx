import React from 'react';
import { X, CheckCircle2, XCircle, Wrench, Scale } from 'lucide-react';
import { SampleInspectionResult } from '../../types';

interface SampleInspectorModalProps {
  sample: SampleInspectionResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SampleInspectorModal: React.FC<SampleInspectorModalProps> = ({
  sample,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !sample) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                sample.passed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {sample.passed ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-sky-400 font-semibold">{sample.sample_id}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-medium">
                  {sample.category}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">
                Sample Trace & Judge Reasoning ({sample.passed ? 'PASSED' : 'FAILED'})
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* User Prompt */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              User Input Prompt
            </label>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono">
              {sample.input}
            </div>
          </div>

          {/* Target Ground Truth */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Target Ground Truth
            </label>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono">
              {sample.target}
            </div>
          </div>

          {/* Actual Target Agent Output */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Actual Target Agent Output
            </label>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono leading-relaxed">
              {sample.actual_output || <span className="text-slate-600 italic">No output text returned.</span>}
            </div>
          </div>

          {/* Tool Invocations */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-400 font-semibold text-[11px] uppercase tracking-wider">
              <Wrench className="w-3.5 h-3.5" />
              <span>Tool Invocations & Trace ({sample.tool_calls_made.length})</span>
            </div>
            {sample.tool_calls_made.length === 0 ? (
              <p className="text-slate-500 italic p-2 bg-slate-950/40 rounded border border-slate-800/40">
                No tool calls executed.
              </p>
            ) : (
              <div className="space-y-2">
                {sample.tool_calls_made.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-purple-950/20 border border-purple-900/30 rounded-lg font-mono text-[11px] text-purple-200 space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-purple-300">
                      <span>Tool: {tc.tool || 'function'}</span>
                    </div>
                    {tc.args && (
                      <pre className="text-[10px] text-slate-400 overflow-x-auto">
                        Args: {JSON.stringify(tc.args, null, 2)}
                      </pre>
                    )}
                    {tc.result && (
                      <pre className="text-[10px] text-slate-400 overflow-x-auto">
                        Result: {JSON.stringify(tc.result, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Judge Reasoning */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-[11px] uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5" />
              <span>Evaluator Judge Diagnostic Reasoning</span>
            </div>
            <div
              className={`p-3 rounded-lg border font-mono text-xs leading-relaxed ${
                sample.passed
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                  : 'bg-rose-950/20 border-rose-900/40 text-rose-200'
              }`}
            >
              {sample.judge_reasoning}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
