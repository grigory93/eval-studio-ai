import React, { useState } from 'react';
import {
  Check,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileText,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { EvaluationSeed } from '../../types';
import { TAXONOMY_CATEGORIES } from './TaxonomyCoverageMeter';

interface ScenarioProposalCardProps {
  seed: EvaluationSeed;
  onAccept: (seed: EvaluationSeed) => void;
  onDismiss: (seedId: string) => void;
  onUpdate?: (seed: EvaluationSeed) => void;
  readOnly?: boolean;
}

export const ScenarioProposalCard: React.FC<ScenarioProposalCardProps> = ({
  seed,
  onAccept,
  onDismiss,
  onUpdate,
  readOnly = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editIntent, setEditIntent] = useState(seed.scenario_intent);
  const [editInput, setEditInput] = useState(
    typeof seed.sample_input === 'string'
      ? seed.sample_input
      : JSON.stringify(seed.sample_input, null, 2)
  );
  const [editTarget, setEditTarget] = useState(seed.expected_target);
  const [editRubric, setEditRubric] = useState(seed.grading_rubric);
  const [editTools, setEditTools] = useState(
    (seed.expected_tools || []).join(', ')
  );

  const categoryMeta = TAXONOMY_CATEGORIES.find((c) => c.key === seed.category) || {
    key: seed.category,
    label: seed.category,
    icon: Sparkles,
    color: 'text-zinc-300',
    bgLight: 'bg-zinc-800',
    borderColor: 'border-zinc-700',
    barColor: 'bg-zinc-500',
    targetPercent: 10,
  };
  const CategoryIcon = categoryMeta.icon;

  const isAccepted = seed.status === 'accepted';
  const isDismissed = seed.status === 'dismissed';

  const handleSaveEdit = () => {
    let parsedInput: string | Array<Record<string, any>> = editInput;
    try {
      if (editInput.trim().startsWith('[') || editInput.trim().startsWith('{')) {
        parsedInput = JSON.parse(editInput);
      }
    } catch {
      parsedInput = editInput;
    }

    const updated: EvaluationSeed = {
      ...seed,
      scenario_intent: editIntent,
      sample_input: parsedInput,
      expected_target: editTarget,
      grading_rubric: editRubric,
      expected_tools: editTools
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (onUpdate) {
      onUpdate(updated);
    }
    setIsEditing(false);
  };

  const handleAcceptClick = () => {
    if (isEditing) {
      handleSaveEdit();
    }
    onAccept(seed);
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isAccepted
          ? 'bg-zinc-950/80 border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-sm'
          : isDismissed
          ? 'bg-zinc-950/40 border-zinc-800 opacity-60'
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'
      }`}
    >
      {/* Card Header */}
      <div className="p-3.5 sm:p-4 flex items-start justify-between gap-3 border-b border-zinc-800/60">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg ${categoryMeta.bgLight} ${categoryMeta.color} mt-0.5`}>
            <CategoryIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`text-xs font-semibold ${categoryMeta.color}`}>
                {categoryMeta.label}
              </span>

              {seed.source_clause_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                  <FileText className="w-3 h-3 text-zinc-400" />
                  § {seed.source_clause_id}
                </span>
              )}

              {seed.difficulty && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${
                    seed.difficulty === 'hard'
                      ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                      : seed.difficulty === 'medium'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                  }`}
                >
                  {seed.difficulty}
                </span>
              )}

              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  isAccepted
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold'
                    : isDismissed
                    ? 'bg-zinc-800 text-zinc-400'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                }`}
              >
                {isAccepted ? '✓ In Blueprint' : isDismissed ? 'Dismissed' : 'Proposed Seed'}
              </span>
            </div>

            <h5 className="text-sm font-medium text-zinc-100 leading-snug">
              {seed.scenario_intent}
            </h5>
          </div>
        </div>

        {/* Quick action buttons on top right */}
        {!readOnly && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isAccepted && (
              <button
                type="button"
                onClick={handleAcceptClick}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                title="Accept into evaluation blueprint"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Accept</span>
              </button>
            )}

            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="Edit seed scenario"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}

            {!isDismissed && !isAccepted && (
              <button
                type="button"
                onClick={() => onDismiss(seed.seed_id)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                title="Dismiss proposed seed"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-3.5 sm:p-4 text-xs space-y-3">
        {isEditing ? (
          <div className="space-y-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Scenario Intent:
              </label>
              <input
                type="text"
                value={editIntent}
                onChange={(e) => setEditIntent(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Sample Input Prompt:
              </label>
              <textarea
                rows={2}
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Expected Target / Behavior:
              </label>
              <textarea
                rows={2}
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Grading Rubric / Boundary:
              </label>
              <input
                type="text"
                value={editRubric}
                onChange={(e) => setEditRubric(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Expected Tools (comma-separated):
              </label>
              <input
                type="text"
                value={editTools}
                onChange={(e) => setEditTools(e.target.value)}
                placeholder="e.g. lookup_order, process_refund"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Sample Input Preview */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Sample Input Prompt
              </span>
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono text-zinc-200 text-xs break-words">
                {typeof seed.sample_input === 'string'
                  ? seed.sample_input
                  : JSON.stringify(seed.sample_input)}
              </div>
            </div>

            {/* Expected Target Preview */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Expected Target / Behavior
              </span>
              <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-zinc-300 text-xs">
                {seed.expected_target}
              </div>
            </div>

            {/* Detailed sections when expanded */}
            {isExpanded && (
              <div className="space-y-2.5 pt-2 border-t border-zinc-800/80 animate-in fade-in duration-200">
                {seed.grading_rubric && (
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                      Grading Rubric / Boundary Criteria
                    </span>
                    <p className="text-xs text-zinc-300 bg-zinc-950/80 p-2 rounded border border-zinc-800">
                      {seed.grading_rubric}
                    </p>
                  </div>
                )}

                {seed.expected_tools && seed.expected_tools.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                      Expected Tool Invocations
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {seed.expected_tools.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px] border border-zinc-700"
                        >
                          <Wrench className="w-3 h-3 text-sky-400" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer CTA if proposed and not editing */}
      {!readOnly && !isAccepted && !isDismissed && !isEditing && (
        <div className="px-4 py-2.5 bg-zinc-950/50 border-t border-zinc-800/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Deduced from spec clause. Accepts into Step 4 synthesis exemplars.
          </span>
          <button
            type="button"
            onClick={handleAcceptClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Accept into Blueprint
          </button>
        </div>
      )}
    </div>
  );
};
