import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Copy, Check, Sparkles } from 'lucide-react';
import { FailureCluster } from '../../types';

interface FailureClusterListProps {
  clusters: FailureCluster[];
  onSelectSampleId?: (sampleId: string) => void;
}

export const FailureClusterList: React.FC<FailureClusterListProps> = ({
  clusters,
  onSelectSampleId,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(clusters[0]?.cluster_id || null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleCopyFix = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!clusters || clusters.length === 0) {
    return (
      <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl text-center space-y-2">
        <Sparkles className="w-8 h-8 text-emerald-400 mx-auto" />
        <h4 className="text-sm font-semibold text-slate-200">Zero Failure Clusters Detected</h4>
        <p className="text-xs text-slate-400">
          The evaluated agent satisfied all policy rules, tool accuracy checks, and edge cases.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {clusters.map((cluster) => {
        const isExpanded = expandedId === cluster.cluster_id;
        const isCopied = copiedId === cluster.cluster_id;

        return (
          <div
            key={cluster.cluster_id}
            className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-all shadow-md"
          >
            {/* Cluster Accordion Header */}
            <div
              onClick={() => toggleExpand(cluster.cluster_id)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-950/40 border border-rose-800/50 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-200">{cluster.title}</h4>
                    <span className="px-2 py-0.2 rounded-full bg-rose-950/60 border border-rose-800/40 text-[10px] font-mono text-rose-300">
                      {cluster.failure_count} Affected Samples
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {cluster.description}
                  </p>
                </div>
              </div>

              <div className="text-slate-500">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="p-4 pt-0 border-t border-slate-800/80 space-y-3 text-xs animate-in fade-in duration-200">
                {/* Root Cause */}
                <div className="space-y-1">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                    Diagnostic Root Cause
                  </span>
                  <p className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300 text-xs leading-relaxed">
                    {cluster.root_cause}
                  </p>
                </div>

                {/* Suggested Fix */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                      Actionable Prompt / Tool Fix
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyFix(cluster.suggested_fix, cluster.cluster_id)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 flex items-center gap-1"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          Copied Fix
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy Fix
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-emerald-200 font-mono text-[11px] whitespace-pre-wrap">
                    {cluster.suggested_fix}
                  </pre>
                </div>

                {/* Affected Sample Chips */}
                {cluster.sample_ids && cluster.sample_ids.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400">Failed Sample IDs:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.sample_ids.map((sid) => (
                        <button
                          key={sid}
                          type="button"
                          onClick={() => onSelectSampleId && onSelectSampleId(sid)}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-400 hover:text-sky-300 hover:border-sky-500 font-mono text-[10px] transition-colors"
                        >
                          {sid}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
