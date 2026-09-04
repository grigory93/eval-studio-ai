import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  User,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Cpu,
  Wrench,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Compass,
  MessageSquare,
  Zap,
  Target,
} from 'lucide-react';
import {
  initiateElicitation,
  sendElicitationMessage,
  confirmCriteria,
  updateCriteria,
  resolveAmbiguity,
  dismissAmbiguity,
  acceptSeed,
  dismissSeed,
  addCustomSeed,
  deepDiveCategory,
} from '../../services/api';
import {
  RequirementDocModel,
  ConfirmedCriteriaModel,
  EvaluationSeed,
  EvalCategory,
} from '../../types';
import { TaxonomyCoverageMeter, TAXONOMY_CATEGORIES } from './TaxonomyCoverageMeter';
import { ScenarioProposalCard } from './ScenarioProposalCard';

interface ChatInterfaceProps {
  doc: RequirementDocModel;
  targetAgentPath?: string;
  onCriteriaConfirmed: (criteria: ConfirmedCriteriaModel) => void;
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  options?: string[];
  proposed_seeds?: EvaluationSeed[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  doc,
  targetAgentPath = 'examples/customer_support_adk/agent.py:root_agent',
  onCriteriaConfirmed,
}) => {
  const [activeCanvasTab, setActiveCanvasTab] = useState<'gaps' | 'chat' | 'walkthrough'>('gaps');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [criteria, setCriteria] = useState<ConfirmedCriteriaModel | null>(null);
  const [ambiguityFilter, setAmbiguityFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  // Blueprint category filter & walkthrough state
  const [selectedBlueprintCategory, setSelectedBlueprintCategory] = useState<EvalCategory | 'all'>('all');
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);

  // Inline custom resolution state for an ambiguity
  const [customResolvingId, setCustomResolvingId] = useState<string | null>(null);
  const [customResolutionText, setCustomResolutionText] = useState('');
  const [customRuleType, setCustomRuleType] = useState<'domain_rules' | 'edge_cases' | 'safety_policies'>('domain_rules');

  // Inline direct editing of criteria items
  const [editingItem, setEditingItem] = useState<{
    type: 'domain_rules' | 'safety_policies' | 'edge_cases' | 'expected_tools';
    index: number;
    text: string;
  } | null>(null);

  // Adding new rule/constraint/edge case inline
  const [addingType, setAddingType] = useState<'domain_rules' | 'safety_policies' | 'edge_cases' | 'expected_tools' | null>(null);
  const [newItemText, setNewItemText] = useState('');

  // Adding custom seed inline
  const [isAddingCustomSeed, setIsAddingCustomSeed] = useState(false);
  const [customSeedCategory, setCustomSeedCategory] = useState<EvalCategory>('happy_path');
  const [customSeedIntent, setCustomSeedIntent] = useState('');
  const [customSeedInput, setCustomSeedInput] = useState('');
  const [customSeedTarget, setCustomSeedTarget] = useState('');
  const [customSeedRubric, setCustomSeedRubric] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initiateChat();
  }, [doc, targetAgentPath]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const initiateChat = async () => {
    setIsLoading(true);
    try {
      const data = await initiateElicitation(doc.doc_id, targetAgentPath);
      setCriteria(data.criteria);
      setMessages([
        {
          id: 'msg-init',
          sender: 'bot',
          text: data.reply,
          options: data.suggested_options,
          proposed_seeds: data.proposed_seeds || [],
        },
      ]);
    } catch {
      // Fallback criteria if backend is unreachable
      const fallbackCriteria: ConfirmedCriteriaModel = {
        criteria_id: `crit-${Date.now()}`,
        use_case: `Evaluation of ${doc.filename}`,
        target_agent_description: 'Target ADK Agent under evaluation',
        target_agent_path: targetAgentPath,
        domain_rules: Object.keys(doc.sections).slice(0, 3).map((k) => `${k}: ${doc.sections[k] || k}`),
        edge_cases: ['Item received damaged during shipping', 'Simulated 500 error when calling backend tools'],
        safety_policies: ['Strictly refuse unauthorized operations'],
        expected_tools: ['lookup_order', 'process_refund'],
        ambiguities: [
          {
            id: 'gap-01',
            category: 'Boundary Exception',
            description: 'Are refunds allowed for opened items received damaged in transit?',
            suggested_question: 'Should the agent permit a refund if packaging is broken upon arrival?',
            status: 'unresolved',
            resolved: false,
            suggested_options: ['Allow refund with photo proof', 'Strictly refuse opened items'],
          },
        ],
        test_seeds: [
          {
            seed_id: 'seed-fb-1',
            category: 'happy_path',
            scenario_intent: 'Standard user request within policy',
            sample_input: 'I would like to process a standard return for order #12345.',
            expected_target: 'Initiate return flow cleanly and verify eligibility',
            grading_rubric: 'Agent confirms order eligibility and outputs return instructions',
            expected_tools: ['lookup_order'],
            status: 'accepted',
          },
        ],
        taxonomy_coverage: {
          happy_path: 0.33,
          edge_case: 0.15,
        },
        evaluation_rubrics: {},
        is_confirmed: false,
      };
      setCriteria(fallbackCriteria);
      setMessages([
        {
          id: 'msg-err',
          sender: 'bot',
          text: `I analyzed ${doc.filename}. Review the detected ambiguities on the left or clarify rules in chat.`,
          options: ['Standard policy rules only', 'Escalate damaged items to supervisor'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Resolve Ambiguity (via quick chip or custom input)
  const handleResolveAmbiguity = async (
    findingId: string,
    resolution: string,
    ruleType: 'domain_rules' | 'edge_cases' | 'safety_policies' = 'domain_rules'
  ) => {
    if (!criteria || !resolution.trim()) return;
    setIsLoading(true);

    try {
      const updated = await resolveAmbiguity(
        criteria.criteria_id,
        findingId,
        resolution.trim(),
        true,
        ruleType
      );
      setCriteria(updated);

      // Add audit message to conversation
      const finding = criteria.ambiguities?.find((a) => a.id === findingId);
      const logMessage: Message = {
        id: `msg-res-${Date.now()}`,
        sender: 'bot',
        text: `✓ Resolved Gap "${finding?.category || findingId}":\n"${resolution.trim()}" has been added to ${ruleType.replace('_', ' ')}.`,
        options: ['Proceed with dataset synthesis', 'Clarify another edge case'],
      };
      setMessages((prev) => [...prev, logMessage]);

      // Reset custom resolution state
      setCustomResolvingId(null);
      setCustomResolutionText('');
    } catch (err: any) {
      console.error('Error resolving ambiguity:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Dismiss Ambiguity
  const handleDismissAmbiguity = async (findingId: string) => {
    if (!criteria) return;
    try {
      const updated = await dismissAmbiguity(criteria.criteria_id, findingId);
      setCriteria(updated);
    } catch (err: any) {
      console.error('Error dismissing ambiguity:', err);
    }
  };

  // 3. Reopen Ambiguity
  const handleReopenAmbiguity = async (findingId: string) => {
    if (!criteria) return;
    const updatedAmbiguities = (criteria.ambiguities || []).map((a) =>
      a.id === findingId ? { ...a, status: 'unresolved' as const, resolved: false, resolution: undefined } : a
    );
    try {
      const updated = await updateCriteria(criteria.criteria_id, {
        ambiguities: updatedAmbiguities,
      });
      setCriteria(updated);
    } catch (err) {
      console.error('Error reopening ambiguity:', err);
    }
  };

  // 4. Chat messaging
  const handleSendMessage = async (textToSend?: string) => {
    const message = textToSend || inputText;
    if (!message.trim() || isLoading || !criteria) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: message,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const mode = activeCanvasTab === 'walkthrough' ? 'walkthrough' : 'chat';
      const response = await sendElicitationMessage(
        criteria.criteria_id,
        message,
        doc.doc_id,
        criteria,
        mode
      );

      setCriteria(response.updated_criteria);

      const botReply: Message = {
        id: `msg-bot-${Date.now()}`,
        sender: 'bot',
        text: response.reply,
        options: response.suggested_options,
        proposed_seeds: response.proposed_seeds,
      };
      setMessages((prev) => [...prev, botReply]);
    } catch (err: any) {
      console.error('Error sending elicitation message:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'bot',
          text: '⚠️ Unable to process your message due to a connection or server error. Your last input was not saved. Please try sending your message again or editing criteria directly.',
          options: ['Retry last message'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Seed Lifecycle Handlers
  const handleAcceptSeed = async (seed: EvaluationSeed) => {
    if (!criteria) return;
    setIsLoading(true);
    try {
      const updated = await acceptSeed(criteria.criteria_id, seed.seed_id, seed);
      setCriteria(updated);

      // Update in message history if present
      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          proposed_seeds: msg.proposed_seeds?.map((s) =>
            s.seed_id === seed.seed_id ? { ...s, status: 'accepted' as const } : s
          ),
        }))
      );
    } catch (err) {
      console.error('Failed to accept seed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissSeed = async (seedId: string) => {
    if (!criteria) return;
    try {
      const updated = await dismissSeed(criteria.criteria_id, seedId);
      setCriteria(updated);

      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          proposed_seeds: msg.proposed_seeds?.map((s) =>
            s.seed_id === seedId ? { ...s, status: 'dismissed' as const } : s
          ),
        }))
      );
    } catch (err) {
      console.error('Failed to dismiss seed:', err);
    }
  };

  const handleTriggerDeepDive = async (category: EvalCategory) => {
    if (!criteria) return;
    setIsLoading(true);
    try {
      const res = await deepDiveCategory(criteria.criteria_id, category);
      setCriteria(res.updated_criteria);

      const categoryMeta = TAXONOMY_CATEGORIES.find((c) => c.key === category);
      const botMessage: Message = {
        id: `msg-deepdive-${Date.now()}`,
        sender: 'bot',
        text: `🔍 **Deep-Dive Audit: ${categoryMeta?.label || category}**\nI analyzed your document for this pillar and generated ${res.seeds.length} test scenario proposals. Review and accept them to include as synthesis exemplars:`,
        proposed_seeds: res.seeds,
        options: [
          `Add more ${categoryMeta?.label || category} scenarios`,
          'Review taxonomy coverage',
        ],
      };
      setMessages((prev) => [...prev, botMessage]);
      setSelectedBlueprintCategory(category);
    } catch (err) {
      console.error('Failed to run category deep dive:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomSeed = async () => {
    if (!criteria || !customSeedIntent.trim() || !customSeedInput.trim()) return;
    setIsLoading(true);
    try {
      const newSeed: EvaluationSeed = {
        seed_id: `custom-seed-${Date.now()}`,
        category: customSeedCategory,
        scenario_intent: customSeedIntent.trim(),
        sample_input: customSeedInput.trim(),
        expected_target: customSeedTarget.trim(),
        grading_rubric: customSeedRubric.trim() || `Must satisfy ${customSeedIntent.trim()}`,
        status: 'accepted',
      };
      const updated = await addCustomSeed(criteria.criteria_id, newSeed);
      setCriteria(updated);
      setIsAddingCustomSeed(false);
      setCustomSeedIntent('');
      setCustomSeedInput('');
      setCustomSeedTarget('');
      setCustomSeedRubric('');
    } catch (err) {
      console.error('Failed to add custom seed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-click addition of a rule from chat options to confirmed criteria
  const handleQuickAddRule = async (ruleText: string) => {
    if (!criteria || !ruleText.trim()) return;
    const list = [...criteria.domain_rules, ruleText.trim()];
    try {
      const updated = await updateCriteria(criteria.criteria_id, { domain_rules: list });
      setCriteria(updated);
    } catch (err) {
      console.error('Failed to quick-add rule to criteria:', err);
    }
  };

  // Direct CRUD for Criteria Items
  const handleSaveEdit = async () => {
    if (!editingItem || !criteria || !editingItem.text.trim()) return;
    const { type, index, text } = editingItem;
    const list = [...(criteria[type] as string[])];
    list[index] = text.trim();

    try {
      const updated = await updateCriteria(criteria.criteria_id, { [type]: list });
      setCriteria(updated);
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to update criteria item:', err);
    }
  };

  const handleDeleteItem = async (
    type: 'domain_rules' | 'safety_policies' | 'edge_cases' | 'expected_tools',
    index: number
  ) => {
    if (!criteria) return;
    const list = (criteria[type] as string[]).filter((_, i) => i !== index);
    try {
      const updated = await updateCriteria(criteria.criteria_id, { [type]: list });
      setCriteria(updated);
    } catch (err) {
      console.error('Failed to delete criteria item:', err);
    }
  };

  const handleAddItem = async () => {
    if (!addingType || !newItemText.trim() || !criteria) return;
    const list = [...(criteria[addingType] as string[]), newItemText.trim()];

    try {
      const updated = await updateCriteria(criteria.criteria_id, { [addingType]: list });
      setCriteria(updated);
      setAddingType(null);
      setNewItemText('');
    } catch (err) {
      console.error('Failed to add criteria item:', err);
    }
  };

  const handleConfirmAndProceed = async () => {
    if (!criteria) return;
    setIsLoading(true);
    try {
      const confirmed = await confirmCriteria(criteria);
      onCriteriaConfirmed(confirmed);
    } catch {
      onCriteriaConfirmed(criteria);
    } finally {
      setIsLoading(false);
    }
  };

  const ambiguities = criteria?.ambiguities || [];
  const unresolvedGaps = ambiguities.filter((a) => (a.status || (a.resolved ? 'resolved' : 'unresolved')) === 'unresolved');
  const resolvedGaps = ambiguities.filter((a) => (a.status || (a.resolved ? 'resolved' : 'unresolved')) === 'resolved');

  const displayedAmbiguities = ambiguities.filter((a) => {
    const status = a.status || (a.resolved ? 'resolved' : 'unresolved');
    if (ambiguityFilter === 'unresolved') return status === 'unresolved';
    if (ambiguityFilter === 'resolved') return status === 'resolved';
    return true;
  });

  const allGapsAddressed = unresolvedGaps.length === 0 && ambiguities.length > 0;

  // Filter seeds for Blueprint pane
  const blueprintSeeds = (criteria?.test_seeds || []).filter((s) => {
    if (s.status !== 'accepted') return false;
    if (selectedBlueprintCategory === 'all') return true;
    return s.category === selectedBlueprintCategory;
  });

  // Current walkthrough category
  const currentWalkthroughCategory = TAXONOMY_CATEGORIES[walkthroughIndex];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Step 3: Interactive Socratic Elicitation Workbench
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
          Socratic Agentic Elicitation & Blueprint Workbench
        </h2>
        <p className="text-xs text-zinc-400 max-w-2xl mx-auto">
          Audit spec coverage against the 7 Inspect AI behavioral pillars, resolve ambiguities, and distill grounded test seeds for dataset synthesis.
        </p>
      </div>

      {/* Main 2-Pane Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =========================================================================
            PANE A (LEFT, 7 COLS, ~58% WIDTH): ACTIVE WORK CANVAS (WALKTHROUGH vs CHAT vs GAPS)
            ========================================================================= */}
        <div className="lg:col-span-7 bg-zinc-900/80 border border-zinc-800 rounded-xl flex flex-col h-[760px] overflow-hidden shadow-lg">
          {/* Active Canvas Tab Header */}
          <div className="px-3 sm:px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveCanvasTab('gaps')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCanvasTab === 'gaps'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="whitespace-nowrap">Detected Gaps & Ambiguities</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                    unresolvedGaps.length > 0
                      ? 'bg-amber-950/80 border border-amber-800/60 text-amber-300'
                      : 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-300'
                  }`}
                >
                  {unresolvedGaps.length} Open
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCanvasTab('chat')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCanvasTab === 'chat'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                <span className="whitespace-nowrap">Socratic Chat Assistant</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>

              <button
                type="button"
                onClick={() => setActiveCanvasTab('walkthrough')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCanvasTab === 'walkthrough'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="whitespace-nowrap">Autonomous Walkthrough</span>
              </button>
            </div>

            <span className="text-[11px] text-zinc-500 font-mono hidden xl:inline shrink-0">
              Gemini 2.5 ADC
            </span>
          </div>

          {/* Tab 1 Content: Detected Gaps & Ambiguities */}
          {activeCanvasTab === 'gaps' && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Filter Bar */}
              <div className="px-4 py-2 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmbiguityFilter('all')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      ambiguityFilter === 'all'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All ({ambiguities.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmbiguityFilter('unresolved')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      ambiguityFilter === 'unresolved'
                        ? 'bg-amber-600 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Open ({unresolvedGaps.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmbiguityFilter('resolved')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      ambiguityFilter === 'resolved'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Resolved ({resolvedGaps.length})
                  </button>
                </div>
                <span className="text-zinc-500 text-[11px]">
                  {displayedAmbiguities.length} {displayedAmbiguities.length === 1 ? 'gap' : 'gaps'}
                </span>
              </div>

              {/* Ambiguities Scroll List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                {displayedAmbiguities.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
                    <p className="text-sm font-medium text-zinc-300">No open ambiguities in this view</p>
                    <p className="text-xs">Switch filters or start an Autonomous Walkthrough to probe the spec.</p>
                  </div>
                ) : (
                  displayedAmbiguities.map((amb) => {
                    const status = amb.status || (amb.resolved ? 'resolved' : 'unresolved');
                    return (
                      <div
                        key={amb.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          status === 'resolved'
                            ? 'bg-zinc-950/40 border-emerald-900/30'
                            : status === 'dismissed'
                            ? 'bg-zinc-950/20 border-zinc-800 opacity-60'
                            : 'bg-zinc-950/80 border-amber-900/40 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-zinc-200">
                            {amb.category}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                              status === 'resolved'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                                : status === 'dismissed'
                                ? 'bg-zinc-800 text-zinc-400'
                                : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                            }`}
                          >
                            {status === 'resolved' ? '✓ Resolved' : status === 'dismissed' ? 'Dismissed' : 'Action Required'}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 mb-2 leading-relaxed">
                          {amb.description}
                        </p>

                        {status === 'resolved' ? (
                          <div className="pt-2 border-t border-emerald-950/50 flex items-center justify-between text-xs text-emerald-400">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                <strong>Rule Added:</strong> {amb.resolution}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleReopenAmbiguity(amb.id)}
                              className="text-zinc-400 hover:text-white text-xs underline ml-2 shrink-0"
                            >
                              Reopen
                            </button>
                          </div>
                        ) : status === 'dismissed' ? (
                          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs">
                            <span className="text-zinc-500 italic">Dismissed without rule</span>
                            <button
                              type="button"
                              onClick={() => handleReopenAmbiguity(amb.id)}
                              className="text-indigo-400 hover:text-indigo-300 text-xs underline"
                            >
                              Restore
                            </button>
                          </div>
                        ) : (
                          /* Actions for Unresolved Gap */
                          <div className="pt-2.5 border-t border-amber-800/30 space-y-2.5">
                            {amb.suggested_options && amb.suggested_options.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                  One-Click Decisions:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {amb.suggested_options.map((opt, optIdx) => (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      disabled={isLoading}
                                      onClick={() => handleResolveAmbiguity(amb.id, opt, 'domain_rules')}
                                      className="text-left px-3 py-2 rounded-lg bg-zinc-900/90 hover:bg-emerald-950/80 hover:border-emerald-500/60 border border-zinc-700/80 text-emerald-300 hover:text-emerald-200 text-xs transition-all flex items-center justify-between group shadow-sm"
                                    >
                                      <span className="truncate mr-1.5">{opt}</span>
                                      <Check className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 shrink-0 text-emerald-400 transition-opacity" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {customResolvingId === amb.id ? (
                              <div className="space-y-2 pt-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                <textarea
                                  rows={2}
                                  value={customResolutionText}
                                  onChange={(e) => setCustomResolutionText(e.target.value)}
                                  placeholder="Type custom rule or policy resolution..."
                                  className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <select
                                    value={customRuleType}
                                    onChange={(e: any) => setCustomRuleType(e.target.value)}
                                    className="bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-md px-2 py-1 text-xs"
                                  >
                                    <option value="domain_rules">Add to Business Rules</option>
                                    <option value="edge_cases">Add to Edge Cases</option>
                                    <option value="safety_policies">Add to Safety Constraints</option>
                                  </select>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => { setCustomResolvingId(null); setCustomResolutionText(''); }}
                                      className="px-2.5 py-1 text-zinc-400 hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!customResolutionText.trim()}
                                      onClick={() => handleResolveAmbiguity(amb.id, customResolutionText, customRuleType)}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50 transition-colors"
                                    >
                                      Save Rule
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomResolvingId(amb.id);
                                    setCustomResolutionText('');
                                  }}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                                >
                                  + Custom Decision
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismissAmbiguity(amb.id)}
                                  className="text-xs text-zinc-500 hover:text-zinc-400"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 2 Content: Socratic Chat Assistant */}
          {activeCanvasTab === 'chat' && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Deep-Dive Quick Action Banner */}
              <div className="px-3 py-1.5 bg-zinc-950 border-b border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <span className="text-zinc-500 font-medium shrink-0 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Deep-Dive Probes:
                </span>
                {TAXONOMY_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleTriggerDeepDive(cat.key)}
                    disabled={isLoading}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/60 shrink-0 transition-colors"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'bot' && (
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[90%] rounded-xl p-3.5 text-xs leading-relaxed space-y-3 ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                          : 'bg-zinc-950/80 border border-zinc-800 text-zinc-200 rounded-bl-none shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>

                      {/* Render Proposed Seeds Inline */}
                      {msg.proposed_seeds && msg.proposed_seeds.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                            Proposed Evaluation Seeds ({msg.proposed_seeds.length})
                          </span>
                          <div className="space-y-2.5">
                            {msg.proposed_seeds.map((seed) => (
                              <ScenarioProposalCard
                                key={seed.seed_id}
                                seed={seed}
                                onAccept={handleAcceptSeed}
                                onDismiss={handleDismissSeed}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick-reply Option Chips with 1-click Add to Criteria */}
                      {msg.options && msg.options.length > 0 && (
                        <div className="pt-1.5 flex flex-wrap gap-2">
                          {msg.options.map((option, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center rounded-lg bg-zinc-900 border border-zinc-700/80 shadow-sm overflow-hidden"
                            >
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleSendMessage(option)}
                                className="px-2.5 py-1.5 text-xs text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/80 transition-all text-left"
                                title="Send this response to assistant"
                              >
                                {option}
                              </button>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleQuickAddRule(option)}
                                className="px-2 py-1.5 bg-zinc-800/90 hover:bg-emerald-900/70 hover:text-emerald-300 border-l border-zinc-700 text-[10px] text-zinc-400 transition-colors font-medium"
                                title="Add directly to business rules"
                              >
                                + Criteria
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {msg.sender === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-zinc-400 text-xs py-2 px-1">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Agent is deducing test scenarios from spec clauses...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Clarify an edge case, specify exceptions, or ask questions..."
                  disabled={isLoading}
                  className="flex-1 px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* Tab 3 Content: Autonomous Walkthrough */}
          {activeCanvasTab === 'walkthrough' && (
            <div className="flex flex-col flex-1 min-h-0 p-4 space-y-4 overflow-y-auto">
              {/* Stepper Navigation */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    Taxonomy Walkthrough Stage: {walkthroughIndex + 1} of {TAXONOMY_CATEGORIES.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={walkthroughIndex === 0}
                      onClick={() => setWalkthroughIndex((prev) => Math.max(0, prev - 1))}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs text-zinc-300"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={walkthroughIndex === TAXONOMY_CATEGORIES.length - 1}
                      onClick={() => setWalkthroughIndex((prev) => Math.min(TAXONOMY_CATEGORIES.length - 1, prev + 1))}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs text-zinc-300"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {TAXONOMY_CATEGORIES.map((cat, idx) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setWalkthroughIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === walkthroughIndex
                          ? `${cat.barColor} ring-1 ring-white/60`
                          : idx < walkthroughIndex
                          ? 'bg-emerald-500/60'
                          : 'bg-zinc-800'
                      }`}
                      title={cat.label}
                    />
                  ))}
                </div>
              </div>

              {/* Active Category Spotlight */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${currentWalkthroughCategory.bgLight} ${currentWalkthroughCategory.color}`}>
                      {React.createElement(currentWalkthroughCategory.icon, { className: 'w-5 h-5' })}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-100">
                        {currentWalkthroughCategory.label}
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Target Ratio: {currentWalkthroughCategory.targetPercent}% of total dataset
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTriggerDeepDive(currentWalkthroughCategory.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow-sm transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Probe Spec & Propose Seeds
                  </button>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80">
                  {currentWalkthroughCategory.key === 'happy_path' &&
                    'Examines standard, compliant user operations directly supported by specification clauses. Verifies that the agent carries out core business procedures correctly.'}
                  {currentWalkthroughCategory.key === 'edge_case' &&
                    'Examines boundary limits, deadline expirations, partial inputs, and condition thresholds mentioned in the documents.'}
                  {currentWalkthroughCategory.key === 'adversarial' &&
                    'Tests resilience against prompt injections, social engineering, unauthorized data extraction, and roleplay jailbreaks.'}
                  {currentWalkthroughCategory.key === 'tool_usage' &&
                    'Tests that the agent invokes the correct tools with proper schema parameters, payload formats, and handles missing arguments.'}
                  {currentWalkthroughCategory.key === 'exception' &&
                    'Audits behavior when external tool calls fail (500 errors, timeouts, invalid IDs), ensuring graceful degradation.'}
                  {currentWalkthroughCategory.key === 'policy_compliance' &&
                    'Verifies absolute safety policies, sensitive PII handling, user privacy guards, and mandatory supervisor escalations.'}
                  {currentWalkthroughCategory.key === 'multi_turn' &&
                    'Validates state retention across multiple conversational turns, context switching, clarifications, and confirmation workflows.'}
                </p>
              </div>

              {/* Proposed seeds for this category */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Seeds Proposed for {currentWalkthroughCategory.label}
                  </h5>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSeedCategory(currentWalkthroughCategory.key);
                      setIsAddingCustomSeed(true);
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Custom Seed
                  </button>
                </div>

                {/* Show seeds matching this category */}
                {(() => {
                  const seedsForCat = (criteria?.test_seeds || []).filter(
                    (s) => s.category === currentWalkthroughCategory.key
                  );
                  if (seedsForCat.length === 0) {
                    return (
                      <div className="p-6 text-center bg-zinc-950/40 rounded-xl border border-zinc-800 text-zinc-500 space-y-2">
                        <p className="text-xs">No seeds proposed for this category yet.</p>
                        <button
                          type="button"
                          onClick={() => handleTriggerDeepDive(currentWalkthroughCategory.key)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
                        >
                          Run Deep-Dive Audit
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {seedsForCat.map((seed) => (
                        <ScenarioProposalCard
                          key={seed.seed_id}
                          seed={seed}
                          onAccept={handleAcceptSeed}
                          onDismiss={handleDismissSeed}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            PANE B (RIGHT, 5 COLS, ~42% WIDTH): LIVE EVALUATION BLUEPRINT & GAUGE
            ========================================================================= */}
        <div className="lg:col-span-5 bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-4 h-[760px] overflow-y-auto shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Confirmed Evaluation Criteria
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                {(criteria?.test_seeds?.filter((s) => s.status === 'accepted').length || 0)} Seeds •{' '}
                {(criteria?.domain_rules.length || 0) +
                  (criteria?.safety_policies.length || 0) +
                  (criteria?.edge_cases.length || 0)}{' '}
                Rules
              </span>
            </div>

            {/* Taxonomy Coverage Meter Gauge */}
            <TaxonomyCoverageMeter
              coverageScores={criteria?.taxonomy_coverage}
              seeds={criteria?.test_seeds}
              selectedCategory={selectedBlueprintCategory}
              onSelectCategory={setSelectedBlueprintCategory}
              onDeepDive={handleTriggerDeepDive}
              compact={true}
            />

            {/* Distilled Seeds Blueprint Filter & List */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Target className="w-3.5 h-3.5" />
                  <span>Accepted Test Seeds ({blueprintSeeds.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingCustomSeed(!isAddingCustomSeed)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Custom Seed
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedBlueprintCategory('all')}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    selectedBlueprintCategory === 'all'
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All
                </button>
                {TAXONOMY_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSelectedBlueprintCategory(c.key)}
                    className={`px-2 py-0.5 rounded-full transition-colors whitespace-nowrap ${
                      selectedBlueprintCategory === c.key
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Form to Add Custom Seed */}
              {isAddingCustomSeed && (
                <div className="p-3 bg-zinc-900 border border-indigo-500/60 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 text-[11px]">
                      Add Custom Evaluation Seed
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomSeed(false)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    value={customSeedCategory}
                    onChange={(e: any) => setCustomSeedCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  >
                    {TAXONOMY_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={customSeedIntent}
                    onChange={(e) => setCustomSeedIntent(e.target.value)}
                    placeholder="Scenario intent (e.g. Reject return of hazmat goods)"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                  <textarea
                    rows={2}
                    value={customSeedInput}
                    onChange={(e) => setCustomSeedInput(e.target.value)}
                    placeholder="Sample input prompt..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono"
                  />
                  <textarea
                    rows={2}
                    value={customSeedTarget}
                    onChange={(e) => setCustomSeedTarget(e.target.value)}
                    placeholder="Expected agent behavior / answer..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomSeed(false)}
                      className="px-2 py-1 text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!customSeedIntent.trim() || !customSeedInput.trim()}
                      onClick={handleSaveCustomSeed}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium"
                    >
                      Add Seed
                    </button>
                  </div>
                </div>
              )}

              {/* Seed Items List */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                {blueprintSeeds.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic text-center py-2">
                    No accepted seeds in this category yet. Accept proposals from Socratic Chat or Walkthrough.
                  </p>
                ) : (
                  blueprintSeeds.map((seed) => (
                    <div
                      key={seed.seed_id}
                      className="p-2.5 bg-zinc-900/90 border border-emerald-900/30 rounded-lg text-xs space-y-1 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-mono">
                            {seed.category}
                          </span>
                          <span className="font-medium text-zinc-200 truncate">
                            {seed.scenario_intent}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDismissSeed(seed.seed_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-400 transition-opacity"
                          title="Remove seed"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-zinc-400 line-clamp-2">
                        {typeof seed.sample_input === 'string'
                          ? seed.sample_input
                          : JSON.stringify(seed.sample_input)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Target Agent & Inferred Tools */}
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Target Agent & Tools</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingType('expected_tools')}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Tool
                </button>
              </div>
              <p className="text-[10px] font-mono text-zinc-400 truncate">
                {criteria?.target_agent_path || targetAgentPath}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {criteria?.expected_tools.map((tool, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/40 border border-emerald-800/40 rounded text-[10px] font-mono text-emerald-300 group"
                  >
                    {tool}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem('expected_tools', idx)}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Section 1: Core Business Rules */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Core Business Rules ({criteria?.domain_rules.length || 0})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingType('domain_rules')}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>

              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                {criteria?.domain_rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-zinc-950/80 border border-zinc-800/80 rounded-lg text-xs text-zinc-300 flex items-start justify-between gap-2 group"
                  >
                    {editingItem?.type === 'domain_rules' && editingItem.index === idx ? (
                      <div className="flex-1 space-y-1">
                        <textarea
                          rows={2}
                          value={editingItem.text}
                          onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                          className="w-full p-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-1.5 py-0.5 text-[10px] text-zinc-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-2 py-0.5 text-[10px] bg-indigo-600 text-white rounded"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="leading-snug">{rule}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingItem({ type: 'domain_rules', index: idx, text: rule })}
                            className="p-1 hover:text-indigo-400 text-zinc-400"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('domain_rules', idx)}
                            className="p-1 hover:text-rose-400 text-zinc-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Safety & Negative Constraints */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Safety & Constraints ({criteria?.safety_policies.length || 0})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingType('safety_policies')}
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Policy
                </button>
              </div>

              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                {criteria?.safety_policies.map((pol, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-rose-950/20 border border-rose-900/30 rounded-lg text-xs text-rose-200 flex items-start justify-between gap-2 group"
                  >
                    {editingItem?.type === 'safety_policies' && editingItem.index === idx ? (
                      <div className="flex-1 space-y-1">
                        <textarea
                          rows={2}
                          value={editingItem.text}
                          onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                          className="w-full p-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-1.5 py-0.5 text-[10px] text-zinc-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-2 py-0.5 text-[10px] bg-rose-600 text-white rounded"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="leading-snug">{pol}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingItem({ type: 'safety_policies', index: idx, text: pol })}
                            className="p-1 hover:text-rose-300 text-zinc-400"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('safety_policies', idx)}
                            className="p-1 hover:text-rose-400 text-zinc-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Edge Cases & Boundaries */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Edge Cases & Boundaries ({criteria?.edge_cases.length || 0})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingType('edge_cases')}
                  className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Edge Case
                </button>
              </div>

              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                {criteria?.edge_cases.map((edge, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-amber-950/20 border border-amber-900/30 rounded-lg text-xs text-amber-200/90 flex items-start justify-between gap-2 group"
                  >
                    {editingItem?.type === 'edge_cases' && editingItem.index === idx ? (
                      <div className="flex-1 space-y-1">
                        <textarea
                          rows={2}
                          value={editingItem.text}
                          onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                          className="w-full p-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-1.5 py-0.5 text-[10px] text-zinc-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-2 py-0.5 text-[10px] bg-amber-600 text-white rounded"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="leading-snug">{edge}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingItem({ type: 'edge_cases', index: idx, text: edge })}
                            className="p-1 hover:text-amber-300 text-zinc-400"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('edge_cases', idx)}
                            className="p-1 hover:text-rose-400 text-zinc-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal/Form for Adding New Item */}
            {addingType && (
              <div className="p-3 bg-zinc-950 border border-indigo-500/60 rounded-xl space-y-2 animate-in fade-in duration-200">
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Add New {addingType.replace('_', ' ').slice(0, -1)}
                </span>
                <textarea
                  rows={2}
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Enter criteria description..."
                  className="w-full p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <div className="flex justify-end gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => { setAddingType(null); setNewItemText(''); }}
                    className="px-2.5 py-1 text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!newItemText.trim()}
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Confirmation & Synthesis CTA */}
          <div className="pt-3 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>Accepted test seeds:</span>
              <span className="font-mono font-bold text-emerald-400">
                {(criteria?.test_seeds?.filter((s) => s.status === 'accepted').length || 0)} seeds ready
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmAndProceed}
              disabled={isLoading || !criteria}
              className={`w-full py-2.5 text-white font-medium text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                allGapsAddressed
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                  : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {allGapsAddressed
                    ? '✓ All Gaps Addressed: Synthesize Dataset'
                    : 'Confirm Criteria & Synthesize Dataset'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-zinc-500">
              Accepted seeds and boundary constraints will prime Step 4 dataset synthesis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
