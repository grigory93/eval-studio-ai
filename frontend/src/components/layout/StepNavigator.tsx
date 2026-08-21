import React from 'react';
import {
  FileText,
  MessageSquare,
  Database,
  Layers,
  PlayCircle,
  Award,
  Check,
} from 'lucide-react';

interface StepNavigatorProps {
  currentStep: number;
  maxStepReached: number;
  onStepClick: (step: number) => void;
}

const STEPS = [
  { id: 1, label: '1. Ingest Spec', icon: FileText },
  { id: 2, label: '2. Elicitation', icon: MessageSquare },
  { id: 3, label: '3. Dataset Grid', icon: Database },
  { id: 4, label: '4. Task View', icon: Layers },
  { id: 5, label: '5. Live Run', icon: PlayCircle },
  { id: 6, label: '6. Scorecard', icon: Award },
];

export const StepNavigator: React.FC<StepNavigatorProps> = ({
  currentStep,
  maxStepReached,
  onStepClick,
}) => {
  return (
    <div className="w-full bg-slate-950/60 border-b border-slate-800/80 py-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Progress" className="flex justify-center">
          <ol className="flex items-center gap-1 sm:gap-3 flex-wrap justify-center">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isCurrent = currentStep === step.id;
              const isPassed = maxStepReached >= step.id && currentStep > step.id;
              const isClickable = maxStepReached >= step.id;

              return (
                <li key={step.id} className="flex items-center">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => onStepClick(step.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isCurrent
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20 font-semibold'
                        : isPassed
                        ? 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                        : 'bg-slate-950 text-slate-600 cursor-not-allowed border border-slate-900'
                    }`}
                  >
                    {isPassed ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                    )}
                    <span>{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
};
