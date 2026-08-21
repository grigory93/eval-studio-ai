import React from 'react';
import { Sparkles, ShieldCheck, Cpu, RefreshCw } from 'lucide-react';

interface HeaderProps {
  currentStep: number;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentStep, onReset }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onReset}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-tight">
                EvalStudio <span className="text-sky-400">AI</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-semibold text-sky-400">
                Phase 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Zero-Code GenAI Agent Evaluation & Continuous Diagnostics
            </p>
          </div>
        </div>

        {/* Badges & Actions */}
        <div className="flex items-center gap-3">
          {/* Inspect AI Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Inspect AI Harness</span>
          </div>

          {/* Vertex AI ADC Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vertex AI (ADC Auth)</span>
          </div>

          {/* Reset Button */}
          {currentStep > 1 && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-800 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Evaluation
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
