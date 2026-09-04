import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Layers,
  X,
} from 'lucide-react';
import { ExecutiveScorecardReport, SampleInspectionResult } from '../../types';
import { FailureClusterList } from './FailureClusterList';
import { SampleInspectorModal } from './SampleInspectorModal';

interface ScorecardDashboardProps {
  scorecard: ExecutiveScorecardReport;
  onReEvaluate: () => void;
}

export const ScorecardDashboard: React.FC<ScorecardDashboardProps> = ({
  scorecard,
  onReEvaluate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterPassed, setFilterPassed] = useState<'all' | 'passed' | 'failed'>('all');
  const [selectedSample, setSelectedSample] = useState<SampleInspectionResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { metrics, failure_clusters, actionable_recommendations, comparative_delta } = scorecard;

  // Base samples filtered by selected category (if any)
  const categorySamples = selectedCategory
    ? scorecard.sample_details.filter((s) => s.category === selectedCategory)
    : scorecard.sample_details;

  // Dynamically calculate counts within the active category scope
  const categoryTotalCount = categorySamples.length;
  const categoryPassedCount = categorySamples.filter((s) => s.passed).length;
  const categoryFailedCount = categorySamples.filter((s) => !s.passed).length;

  // Multiplicative filter applying status filter (all | passed | failed)
  const filteredSamples = categorySamples.filter((s) => {
    if (filterPassed === 'passed') return s.passed;
    if (filterPassed === 'failed') return !s.passed;
    return true;
  });

  const handleSelectSampleById = (sampleId: string) => {
    const s = scorecard.sample_details.find((item) => item.sample_id === sampleId);
    if (s) {
      setSelectedSample(s);
      setIsModalOpen(true);
    }
  };

  const handleDownloadMarkdown = () => {
    window.open(`/api/scorecard/${scorecard.eval_id}/export/markdown`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Step 7: Executive Evaluation Scorecard & Diagnostics
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-sky-400" />
            {scorecard.task_name} Scorecard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluation ID: <span className="font-mono text-slate-300">{scorecard.eval_id}</span> • {scorecard.timestamp}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Markdown Report
          </button>
          <button
            type="button"
            onClick={onReEvaluate}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Re-Evaluate Suite
          </button>
        </div>
      </div>

      {/* Comparative Regression Delta Banner */}
      {comparative_delta && (
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {comparative_delta.overall_pass_rate_delta >= 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-400" />
            )}
            <div>
              <h4 className="text-xs font-bold text-slate-200">
                Regression Comparison against Baseline ({comparative_delta.baseline_eval_id})
              </h4>
              <p className="text-[11px] text-slate-400">
                Overall Delta: <span className={comparative_delta.overall_pass_rate_delta >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {comparative_delta.overall_pass_rate_delta > 0 ? '+' : ''}
                  {Math.round(comparative_delta.overall_pass_rate_delta * 100)}%
                </span> • {comparative_delta.newly_passed_sample_ids.length} newly fixed • {comparative_delta.newly_failed_sample_ids.length} newly regressed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top-Line KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Pass Rate */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Overall Pass %</span>
          <div className="text-2xl font-black text-emerald-400">
            {Math.round(metrics.overall_pass_rate * 100)}%
          </div>
          <p className="text-[10px] text-slate-500">{metrics.passed_samples}/{metrics.total_samples} samples passed</p>
        </div>

        {/* Policy Adherence */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Policy Adherence</span>
          <div className="text-2xl font-black text-sky-400">
            {Math.round(metrics.policy_adherence_score * 100)}%
          </div>
          <p className="text-[10px] text-slate-500">Refusal & safety adherence</p>
        </div>

        {/* Tool Accuracy */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Tool Accuracy</span>
          <div className="text-2xl font-black text-purple-400">
            {Math.round(metrics.tool_selection_accuracy * 100)}%
          </div>
          <p className="text-[10px] text-slate-500">Deterministic verifier</p>
        </div>

        {/* Failed / Errored */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Failures / Errors</span>
          <div className="text-2xl font-black text-rose-400">
            {metrics.failed_samples + metrics.errored_samples}
          </div>
          <p className="text-[10px] text-slate-500">{metrics.failed_samples} failed, {metrics.errored_samples} errors</p>
        </div>

        {/* Latency */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Avg Latency</span>
          <div className="text-2xl font-black text-slate-200">
            {metrics.avg_latency_seconds}s
          </div>
          <p className="text-[10px] text-slate-500">Per test sample</p>
        </div>

        {/* Estimated Cost */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Eval Token Cost</span>
          <div className="text-2xl font-black text-amber-400">
            ${metrics.estimated_token_cost_usd}
          </div>
          <p className="text-[10px] text-slate-500">{metrics.total_input_tokens + metrics.total_output_tokens} tokens</p>
        </div>
      </div>

      {/* Category Breakdown & Executive Summary Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Category Breakdown Bars (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Category Pass Rate Distribution (Inspect AI Grouped Metrics)
              </h3>
            </div>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20"
                title="Reset category filter"
              >
                <span>Reset filter</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2 pt-1">
            {Object.entries(metrics.category_pass_rates).map(([cat, rate]) => {
              const isSelected = selectedCategory === cat;
              const pct = Math.round(rate * 100);
              const colorClass =
                pct >= 90
                  ? 'bg-emerald-500'
                  : pct >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-500';

              return (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(isSelected ? null : cat)}
                  className={`p-2.5 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-950/50 border border-sky-500/50 ring-2 ring-sky-500/30 shadow-md'
                      : 'border border-transparent hover:bg-slate-800/60 hover:border-slate-700/80'
                  }`}
                  title={isSelected ? 'Click to deselect category filter' : `Click to filter sample inspector by ${cat}`}
                >
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isSelected ? 'text-sky-300' : 'text-slate-300'}`}>
                        {cat}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/30 text-sky-200 font-sans font-medium">
                          Active Filter
                        </span>
                      )}
                    </div>
                    <span className={pct >= 90 ? 'text-emerald-400 font-bold' : pct >= 70 ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'}>
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Executive Summary & Actionable Recommendations (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Executive AI Diagnostics & Recommendations
            </h3>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            {scorecard.executive_summary}
          </p>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Prioritized Action Items
            </span>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {actionable_recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 p-2 bg-slate-950/40 rounded border border-slate-800/60">
                  <span className="font-mono text-sky-400 font-bold">{idx + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Failure Clusters Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-slate-200">
            Semantic Failure Clusters ({failure_clusters.length})
          </h3>
        </div>
        <FailureClusterList
          clusters={failure_clusters}
          onSelectSampleId={handleSelectSampleById}
        />
      </div>

      {/* Interactive Sample Inspector Table */}
      <div className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-sm font-bold text-slate-200">Sample Execution Inspector</h3>
            <span className="text-xs text-slate-500 font-mono">
              ({filteredSamples.length} {filteredSamples.length === 1 ? 'sample' : 'samples'})
            </span>

            {/* Active Category Filter Chip */}
            {selectedCategory && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-medium">
                <span>Category: <strong className="font-semibold text-white">{selectedCategory}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="hover:text-white p-0.5 rounded-full hover:bg-sky-500/30 transition-colors"
                  title="Clear category filter"
                  aria-label="Clear category filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>

          <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setFilterPassed('all')}
              className={`px-3 py-1 rounded transition-colors ${
                filterPassed === 'all' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({categoryTotalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterPassed('passed')}
              className={`px-3 py-1 rounded transition-colors ${
                filterPassed === 'passed' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Passed ({categoryPassedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterPassed('failed')}
              className={`px-3 py-1 rounded transition-colors ${
                filterPassed === 'failed' ? 'bg-rose-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Failed ({categoryFailedCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-400 sticky top-0 z-10 border-b border-slate-800 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3 w-16">Status</th>
                <th className="py-2.5 px-3 w-28">Sample ID</th>
                <th className="py-2.5 px-3 w-32">Category</th>
                <th className="py-2.5 px-3">Input Prompt</th>
                <th className="py-2.5 px-3">Evaluator Judge Reasoning</th>
                <th className="py-2.5 px-3 w-20 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CheckCircle2 className="w-7 h-7 text-slate-600" />
                      <p className="text-xs text-slate-400 font-medium">No test samples match the selected filter criteria.</p>
                      {selectedCategory && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(null)}
                          className="text-xs text-sky-400 hover:underline pt-1"
                        >
                          Clear category filter ({selectedCategory})
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSamples.map((sample) => (
                  <tr
                    key={sample.sample_id}
                    onClick={() => {
                      setSelectedSample(sample);
                      setIsModalOpen(true);
                    }}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      {sample.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-sky-400 font-medium">
                      {sample.sample_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCategory(selectedCategory === sample.category ? null : sample.category);
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                          selectedCategory === sample.category
                            ? 'bg-sky-600 text-white font-semibold'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-sky-500/50 hover:text-sky-300'
                        }`}
                        title={selectedCategory === sample.category ? 'Click to deselect' : `Filter by category ${sample.category}`}
                      >
                        {sample.category}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 max-w-xs truncate" title={sample.input}>
                      {sample.input}
                    </td>
                    <td
                      className={`py-2.5 px-3 max-w-sm truncate font-mono text-[11px] ${
                        sample.passed ? 'text-slate-400' : 'text-rose-300 font-semibold'
                      }`}
                      title={sample.judge_reasoning}
                    >
                      {sample.judge_reasoning}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        className="text-sky-400 hover:text-sky-300 font-medium text-xs underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trace Inspector Modal */}
      <SampleInspectorModal
        sample={selectedSample}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSample(null);
        }}
      />
    </div>
  );
};
