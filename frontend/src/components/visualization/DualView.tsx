import React, { useState } from 'react';
import { Layers, Code2, Sparkles, Play, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { CompiledTaskResponse } from '../../types';
import { MermaidViewer } from './MermaidViewer';
import { CodeViewer } from './CodeViewer';

interface DualViewProps {
  compiledTask: CompiledTaskResponse;
  onStartExecution: () => void;
  isExecuting?: boolean;
}

export const DualView: React.FC<DualViewProps> = ({
  compiledTask,
  onStartExecution,
  isExecuting = false,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Step 5: Task View & Architecture
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
            {compiledTask.task_name}
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
            Compiled multi-scorer evaluation task bridging Inspect AI solvers with target ADK agent.
          </p>
        </div>

        {/* Action Trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onStartExecution}
            disabled={isExecuting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Run Evaluation in Isolated Sandbox
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'visual'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Business Flow Diagram (Mermaid.js)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Inspect AI Task Code (task.py)
          </button>
        </div>

        {/* Security & Sandbox Badge */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Worker Process Isolation Enabled</span>
        </div>
      </div>

      {/* Main View Area */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 min-h-[480px] shadow-xl">
        {activeTab === 'visual' ? (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-center justify-between">
              <span>
                <strong>Sequence:</strong> Personas → Target ADK Agent → Tool Hooks → Gemini 2.5 Judges → Diagnostics
              </span>
              <span className="text-sky-400 font-mono text-[11px]">
                Target: {compiledTask.config.target_agent_path}
              </span>
            </div>
            <MermaidViewer chart={compiledTask.mermaid_diagram.diagram_code} />
          </div>
        ) : (
          <CodeViewer
            taskCode={compiledTask.task_code}
            samplesJson={compiledTask.samples_json}
            sampleCount={compiledTask.sample_count}
            filename={`${compiledTask.task_name}.py`}
          />
        )}
      </div>

      {/* Multi-Scorer Spec Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Model-Graded QA Judge</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Scores response correctness, helpfulness, and resolution quality against ground truth targets.
          </p>
        </div>

        <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Policy Adherence Judge</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Evaluates strict compliance with non-refundable hygiene exclusions, $100 limits, and prompt safety.
          </p>
        </div>

        <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-purple-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Deterministic Tool Verifier</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Validates exact function calls (`lookup_order`, `process_refund`, `escalate_to_human`) and arguments.
          </p>
        </div>
      </div>
    </div>
  );
};
