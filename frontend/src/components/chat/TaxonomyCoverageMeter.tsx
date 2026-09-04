import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Flame,
  Wrench,
  AlertOctagon,
  ShieldCheck,
  MessagesSquare,
  Sparkles,
} from 'lucide-react';
import { EvalCategory, EvaluationSeed } from '../../types';

export interface CategoryMeta {
  key: EvalCategory;
  label: string;
  targetPercent: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
  borderColor: string;
  barColor: string;
}

export const TAXONOMY_CATEGORIES: CategoryMeta[] = [
  {
    key: 'happy_path',
    label: 'Happy Path',
    targetPercent: 20,
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    barColor: 'bg-emerald-500',
  },
  {
    key: 'edge_case',
    label: 'Edge Cases',
    targetPercent: 15,
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgLight: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    barColor: 'bg-amber-500',
  },
  {
    key: 'adversarial',
    label: 'Adversarial / Red Team',
    targetPercent: 15,
    icon: Flame,
    color: 'text-rose-400',
    bgLight: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    barColor: 'bg-rose-500',
  },
  {
    key: 'tool_usage',
    label: 'Tool Usage & Schema',
    targetPercent: 15,
    icon: Wrench,
    color: 'text-sky-400',
    bgLight: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    barColor: 'bg-sky-500',
  },
  {
    key: 'exception',
    label: 'Exceptions & Fallbacks',
    targetPercent: 15,
    icon: AlertOctagon,
    color: 'text-orange-400',
    bgLight: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    barColor: 'bg-orange-500',
  },
  {
    key: 'policy_compliance',
    label: 'Safety & Compliance',
    targetPercent: 10,
    icon: ShieldCheck,
    color: 'text-purple-400',
    bgLight: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    barColor: 'bg-purple-500',
  },
  {
    key: 'multi_turn',
    label: 'Multi-Turn & State',
    targetPercent: 10,
    icon: MessagesSquare,
    color: 'text-indigo-400',
    bgLight: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    barColor: 'bg-indigo-500',
  },
];

interface TaxonomyCoverageMeterProps {
  coverageScores?: Record<string, number>;
  seeds?: EvaluationSeed[];
  selectedCategory?: EvalCategory | 'all';
  onSelectCategory?: (category: EvalCategory | 'all') => void;
  onDeepDive?: (category: EvalCategory) => void;
  compact?: boolean;
}

export const TaxonomyCoverageMeter: React.FC<TaxonomyCoverageMeterProps> = ({
  coverageScores = {},
  seeds = [],
  selectedCategory = 'all',
  onSelectCategory,
  onDeepDive,
  compact = false,
}) => {
  // Compute seed counts per category
  const countsByCategory = React.useMemo(() => {
    const counts: Record<EvalCategory, { accepted: number; proposed: number }> = {
      happy_path: { accepted: 0, proposed: 0 },
      edge_case: { accepted: 0, proposed: 0 },
      adversarial: { accepted: 0, proposed: 0 },
      tool_usage: { accepted: 0, proposed: 0 },
      exception: { accepted: 0, proposed: 0 },
      policy_compliance: { accepted: 0, proposed: 0 },
      multi_turn: { accepted: 0, proposed: 0 },
    };

    seeds.forEach((s) => {
      const cat = s.category;
      if (counts[cat]) {
        if (s.status === 'accepted') {
          counts[cat].accepted += 1;
        } else if (s.status === 'proposed') {
          counts[cat].proposed += 1;
        }
      }
    });

    return counts;
  }, [seeds]);

  // Overall coverage calculation
  const overallCoverage = React.useMemo(() => {
    const categories = TAXONOMY_CATEGORIES.map((c) => c.key);
    let totalScore = 0;
    categories.forEach((cat) => {
      const score =
        coverageScores[cat] ??
        (countsByCategory[cat].accepted > 0 ? Math.min(1.0, countsByCategory[cat].accepted / 3.0) : 0);
      totalScore += score;
    });
    return Math.round((totalScore / categories.length) * 100);
  }, [coverageScores, countsByCategory]);

  const totalAcceptedSeeds = React.useMemo(() => {
    return seeds.filter((s) => s.status === 'accepted').length;
  }, [seeds]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm">
      {/* Header with overall score */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Taxonomy Coverage Engine
            </h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
              {totalAcceptedSeeds} Accepted Seeds
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit coverage across the 7 Inspect AI behavioral taxonomy pillars
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-1 justify-end">
            <span
              className={`text-xl font-bold font-mono ${
                overallCoverage >= 80
                  ? 'text-emerald-400'
                  : overallCoverage >= 40
                  ? 'text-amber-400'
                  : 'text-zinc-300'
              }`}
            >
              {overallCoverage}%
            </span>
            <span className="text-xs text-zinc-500">readiness</span>
          </div>
          <span className="text-[10px] text-zinc-500">
            {overallCoverage >= 70 ? 'Synthesis Ready' : 'Probing in Progress'}
          </span>
        </div>
      </div>

      {/* Main overall progress bar */}
      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 ${
            overallCoverage >= 80
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : overallCoverage >= 40
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
              : 'bg-gradient-to-r from-indigo-600 to-sky-400'
          }`}
          style={{ width: `${Math.min(100, Math.max(5, overallCoverage))}%` }}
        />
      </div>

      {/* Category breakdown grid */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
        {TAXONOMY_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = countsByCategory[cat.key];
          const rawScore =
            coverageScores[cat.key] ??
            (count.accepted > 0 ? Math.min(1.0, count.accepted / 3.0) : 0);
          const scorePercent = Math.round(rawScore * 100);
          const isSelected = selectedCategory === cat.key;
          const status =
            count.accepted >= 2 || rawScore >= 0.7
              ? 'complete'
              : count.accepted > 0 || count.proposed > 0 || rawScore > 0.2
              ? 'partial'
              : 'gap';

          return (
            <div
              key={cat.key}
              onClick={() => onSelectCategory?.(cat.key)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                isSelected
                  ? 'bg-zinc-800/90 border-indigo-500/60 ring-1 ring-indigo-500/40'
                  : 'bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cat.color}`} />
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {cat.label}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    status === 'complete'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                      : status === 'partial'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                      : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                  }`}
                >
                  {status === 'complete' ? 'Covered' : status === 'partial' ? 'Partial' : 'Gap'}
                </span>
              </div>

              {/* Progress bar per category */}
              <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full transition-all duration-300 ${cat.barColor}`}
                  style={{ width: `${Math.min(100, Math.max(scorePercent > 0 ? 8 : 0, scorePercent))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-mono">
                  <span className="text-zinc-200 font-semibold">{count.accepted}</span> accepted
                  {count.proposed > 0 && (
                    <span className="text-amber-400 ml-1">({count.proposed} new)</span>
                  )}
                </span>

                {onDeepDive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeepDive(cat.key);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                  >
                    Deep-Dive
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
