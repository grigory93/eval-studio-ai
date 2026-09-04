import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Search,
  Wrench,
  Check,
} from 'lucide-react';
import { inspectAgent, getSampleAgents } from '../../services/api';
import { SampleAgentInfo } from '../../types';

interface AgentSelectorProps {
  initialSpec?: string;
  onAgentSelected: (spec: string, tools: string[]) => void;
}

const DEFAULT_SAMPLE_AGENTS: SampleAgentInfo[] = [
  {
    id: 'customer-support',
    name: 'Customer Support ADK Agent',
    description: 'E-commerce refund and order management agent with lookup and refund tools.',
    spec: 'examples/customer_support_adk/agent.py:root_agent',
    tools: ['lookup_order', 'process_refund', 'escalate_to_human'],
  },
  {
    id: 'hr-benefits',
    name: 'HR Benefits ADK Agent',
    description: 'Enterprise HR employee policy advisor covering PTO, healthcare, and 401(k).',
    spec: 'examples/hr_benefits_adk/agent.py:root_agent',
    tools: ['lookup_employee_pto', 'submit_leave_request'],
  },
];

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  initialSpec = 'examples/customer_support_adk/agent.py:root_agent',
  onAgentSelected,
}) => {
  const [sampleAgents, setSampleAgents] = useState<SampleAgentInfo[]>(DEFAULT_SAMPLE_AGENTS);
  const [selectedSpec, setSelectedSpec] = useState<string>(initialSpec);
  const [customSpecInput, setCustomSpecInput] = useState<string>('');
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');

  const [currentTools, setCurrentTools] = useState<string[]>(DEFAULT_SAMPLE_AGENTS[0].tools);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectionValid, setInspectionValid] = useState<boolean>(true);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  // Fetch presets on mount
  useEffect(() => {
    let isMounted = true;
    getSampleAgents()
      .then((agents) => {
        if (isMounted && agents && agents.length > 0) {
          setSampleAgents(agents);
          const match = agents.find((a) => a.spec === selectedSpec);
          if (match) {
            setCurrentTools(match.tools);
          }
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_SAMPLE_AGENTS
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectPreset = async (agent: SampleAgentInfo) => {
    setMode('preset');
    setSelectedSpec(agent.spec);
    setInspectionError(null);
    setInspectionValid(true);
    setIsInspecting(true);

    try {
      const result = await inspectAgent(agent.spec);
      if (result.valid) {
        setCurrentTools(result.tools.length > 0 ? result.tools : agent.tools);
        setInspectionValid(true);
      } else {
        setCurrentTools(agent.tools);
        setInspectionValid(true);
      }
    } catch {
      // Offline / fallback to static tools
      setCurrentTools(agent.tools);
      setInspectionValid(true);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleInspectCustom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const specToInspect = customSpecInput.trim();
    if (!specToInspect) {
      setInspectionError('Please enter an agent specification (e.g. path/to/agent.py:root_agent)');
      setInspectionValid(false);
      return;
    }

    setIsInspecting(true);
    setInspectionError(null);

    try {
      const result = await inspectAgent(specToInspect);
      if (result.valid) {
        setSelectedSpec(specToInspect);
        setCurrentTools(result.tools);
        setInspectionValid(true);
      } else {
        setInspectionValid(false);
        setInspectionError(result.error || 'Failed to inspect agent module or root_agent instance');
      }
    } catch (err: any) {
      setInspectionValid(false);
      setInspectionError(err.message || 'Inspection error: agent spec could not be resolved');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleProceed = () => {
    if (!selectedSpec) return;
    onAgentSelected(selectedSpec, currentTools);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Step 1: Target Agent Specification
        </div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
          Select or Specify the Agent Under Test
        </h2>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Choose a local Google ADK agent project or select from pre-configured domain templates.
          EvalStudio AI will inspect its declared tools and capabilities.
        </p>
      </div>

      {/* Option A: Pre-Configured Sample Agents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Pre-Configured Sample Agents
            </span>
          </div>
          <span className="text-xs text-slate-500">Ready-to-evaluate benchmarks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sampleAgents.map((ag) => {
            const isSelected = mode === 'preset' && selectedSpec === ag.spec;
            return (
              <div
                key={ag.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectPreset(ag)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPreset(ag);
                  }
                }}
                className={`p-5 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-sky-950/40 border-sky-500 shadow-md shadow-sky-500/10 ring-1 ring-sky-500/50'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/50">
                      {ag.id}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm text-slate-100">{ag.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{ag.description}</p>
                  <p className="text-[11px] font-mono text-slate-500 truncate bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
                    {ag.spec}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Wrench className="w-3 h-3 text-slate-500 mr-0.5" />
                    {ag.tools.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] font-mono text-sky-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Option B: Custom Local ADK Agent Specification */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Or Specify Custom Local ADK Agent
            </span>
          </div>
          <span className="text-xs text-slate-500">Path to Python agent file & instance</span>
        </div>

        <form onSubmit={handleInspectCustom} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={customSpecInput}
              onChange={(e) => {
                setCustomSpecInput(e.target.value);
                setMode('custom');
              }}
              placeholder="e.g. examples/customer_support_adk/agent.py:root_agent"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isInspecting || !customSpecInput.trim()}
            className="px-4 py-2.5 bg-slate-800 hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            {isInspecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Inspecting...
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                Inspect Agent
              </>
            )}
          </button>
        </form>

        {inspectionError && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2.5 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Inspection Failed</p>
              <p className="text-[11px] text-red-300 mt-0.5">{inspectionError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Agent Inspector Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Selected Target Agent:</span>
                <span className="text-xs font-mono text-sky-300 font-semibold">{selectedSpec}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Google ADK Framework • Ready for Socratic evaluation & multi-scorer testing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[11px] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ready for Evaluation</span>
          </div>
        </div>

        {/* Introspected Tools */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-slate-300 uppercase tracking-wider">
              Declared & Inferred Tools ({currentTools.length})
            </h4>
            <span className="text-[11px] text-slate-500">
              EvalStudio AI will generate tool verification scorers for these interfaces
            </span>
          </div>

          {currentTools.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {currentTools.map((tool, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-800/90 rounded-md text-xs font-mono text-sky-300 shadow-sm"
                >
                  <Wrench className="w-3 h-3 text-slate-500" />
                  <span>{tool}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No tools detected or agent operates purely via natural language.</p>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            disabled={!inspectionValid || !selectedSpec}
            onClick={handleProceed}
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-md shadow-sky-600/20 transition-all flex items-center gap-2"
          >
            Proceed to Specification Ingestion
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
