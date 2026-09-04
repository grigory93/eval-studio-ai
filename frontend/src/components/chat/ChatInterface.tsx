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
} from 'lucide-react';
import {
  initiateElicitation,
  sendElicitationMessage,
  confirmCriteria,
  updateCriteria,
  resolveAmbiguity,
  dismissAmbiguity,
} from '../../services/api';
import {
  RequirementDocModel,
  ConfirmedCriteriaModel,
} from '../../types';

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
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  doc,
  targetAgentPath = 'examples/customer_support_adk/agent.py:root_agent',
  onCriteriaConfirmed,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [criteria, setCriteria] = useState<ConfirmedCriteriaModel | null>(null);
  const [ambiguityFilter, setAmbiguityFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

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
      const response = await sendElicitationMessage(
        criteria.criteria_id,
        message,
        doc.doc_id,
        criteria
      );

      setCriteria(response.updated_criteria);

      const botReply: Message = {
        id: `msg-bot-${Date.now()}`,
        sender: 'bot',
        text: response.reply,
        options: response.suggested_options,
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

  // 5. Direct CRUD for Criteria Items
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
  const dismissedGaps = ambiguities.filter((a) => a.status === 'dismissed');

  const displayedAmbiguities = ambiguities.filter((a) => {
    const status = a.status || (a.resolved ? 'resolved' : 'unresolved');
    if (ambiguityFilter === 'unresolved') return status === 'unresolved';
    if (ambiguityFilter === 'resolved') return status === 'resolved';
    return true;
  });

  const allGapsAddressed = unresolvedGaps.length === 0 && ambiguities.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Step 2: Interactive Socratic Elicitation Workbench
        </div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
          Resolve Detected Gaps & Refine Business Rules
        </h2>
        <p className="text-xs text-slate-400 max-w-2xl mx-auto">
          Manage detected ambiguities as actionable work items, consult with the Socratic agent in chat, or directly add and edit business rules.
        </p>
      </div>

      {/* Main 3-Column Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =========================================================================
            COLUMN 1: AMBIGUITY INBOX (4 COLS)
            ========================================================================= */}
        <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col h-[650px] overflow-hidden shadow-lg">
          {/* Inbox Header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Detected Gaps & Ambiguities
              </span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-amber-950/50 border border-amber-800/50 text-amber-300">
              {unresolvedGaps.length} Open
            </span>
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setAmbiguityFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                ambiguityFilter === 'all'
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
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
                  : 'text-slate-400 hover:text-slate-200'
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
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resolved ({resolvedGaps.length})
            </button>
          </div>

          {/* Ambiguities Scroll List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {displayedAmbiguities.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                <p className="text-xs">No ambiguities matching filter.</p>
              </div>
            ) : (
              displayedAmbiguities.map((amb) => {
                const status = amb.status || (amb.resolved ? 'resolved' : 'unresolved');
                const isResolved = status === 'resolved';

                return (
                  <div
                    key={amb.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                      isResolved
                        ? 'bg-emerald-950/15 border-emerald-800/40 text-emerald-200/90'
                        : status === 'dismissed'
                        ? 'bg-slate-950/40 border-slate-800 text-slate-400 opacity-60'
                        : 'bg-amber-950/20 border-amber-800/50 text-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Badge & Category */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                          isResolved
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : status === 'dismissed'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-amber-900/60 text-amber-300'
                        }`}
                      >
                        {amb.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{amb.id}</span>
                    </div>

                    {/* Gap Description & Probing Question */}
                    <p className="text-slate-300 leading-relaxed">{amb.description}</p>
                    <p className="italic text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      "{amb.suggested_question}"
                    </p>

                    {/* Resolution Status or Action Buttons */}
                    {isResolved ? (
                      <div className="pt-1.5 border-t border-emerald-800/30 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]" title={amb.resolution}>
                            Resolved: {amb.resolution}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReopenAmbiguity(amb.id)}
                          className="text-slate-400 hover:text-white text-[10px] underline ml-2"
                        >
                          Reopen
                        </button>
                      </div>
                    ) : status === 'dismissed' ? (
                      <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 italic">Dismissed without rule</span>
                        <button
                          type="button"
                          onClick={() => handleReopenAmbiguity(amb.id)}
                          className="text-sky-400 hover:text-sky-300 text-[10px] underline"
                        >
                          Restore
                        </button>
                      </div>
                    ) : (
                      /* Actions for Unresolved Gap */
                      <div className="pt-2 border-t border-amber-800/30 space-y-2">
                        {/* 1-Click Resolution Options */}
                        {amb.suggested_options && amb.suggested_options.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              One-Click Resolutions:
                            </span>
                            <div className="flex flex-col gap-1">
                              {amb.suggested_options.map((opt, optIdx) => (
                                <button
                                  key={optIdx}
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleResolveAmbiguity(amb.id, opt, 'domain_rules')}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-emerald-950/80 hover:border-emerald-500/60 border border-slate-700/80 text-emerald-300 hover:text-emerald-200 text-[11px] transition-all flex items-center justify-between group"
                                >
                                  <span className="truncate">{opt}</span>
                                  <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 ml-1 text-emerald-400" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Custom Resolution Toggle or Form */}
                        {customResolvingId === amb.id ? (
                          <div className="space-y-1.5 pt-1.5 bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <textarea
                              rows={2}
                              value={customResolutionText}
                              onChange={(e) => setCustomResolutionText(e.target.value)}
                              placeholder="Type custom rule or resolution..."
                              className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                            />
                            <div className="flex items-center justify-between gap-1 text-[10px]">
                              <select
                                value={customRuleType}
                                onChange={(e: any) => setCustomRuleType(e.target.value)}
                                className="bg-slate-900 text-slate-300 border border-slate-700 rounded px-1.5 py-1"
                              >
                                <option value="domain_rules">Add to Business Rules</option>
                                <option value="edge_cases">Add to Edge Cases</option>
                                <option value="safety_policies">Add to Safety Constraints</option>
                              </select>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => { setCustomResolvingId(null); setCustomResolutionText(''); }}
                                  className="px-2 py-1 text-slate-400 hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={!customResolutionText.trim()}
                                  onClick={() => handleResolveAmbiguity(amb.id, customResolutionText, customRuleType)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50"
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
                              className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium"
                            >
                              + Custom Decision
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismissAmbiguity(amb.id)}
                              className="text-[11px] text-slate-500 hover:text-slate-400"
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

        {/* =========================================================================
            COLUMN 2: SOCRATIC CHAT ASSISTANT (4 COLS)
            ========================================================================= */}
        <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col h-[650px] overflow-hidden shadow-lg">
          {/* Chat Header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">Socratic Chat Assistant</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Gemini 2.5 ADC</span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-xl p-3 text-xs leading-relaxed space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Quick-reply Option Chips */}
                  {msg.options && msg.options.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {msg.options.map((option, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleSendMessage(option)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-sky-950/80 hover:border-sky-500/50 border border-slate-700/80 rounded-full text-[11px] text-sky-300 hover:text-sky-200 transition-all text-left"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2 px-1">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Agent is evaluating domain boundaries...</span>
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
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Clarify an edge case or ask a question..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* =========================================================================
            COLUMN 3: CRITERIA WORKBENCH & DIRECT MANUAL CRUD (4 COLS)
            ========================================================================= */}
        <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4 h-[650px] overflow-y-auto shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Confirmed Evaluation Criteria
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {(criteria?.domain_rules.length || 0) +
                  (criteria?.safety_policies.length || 0) +
                  (criteria?.edge_cases.length || 0)}{' '}
                Items
              </span>
            </div>

            {/* Target Agent & Inferred Tools */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Target Agent & Tools</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingType('expected_tools')}
                  className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Tool
                </button>
              </div>
              <p className="text-[10px] font-mono text-slate-400 truncate">
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
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Core Business Rules ({criteria?.domain_rules.length || 0})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingType('domain_rules')}
                  className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 font-medium"
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {criteria?.domain_rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-slate-950/80 border border-slate-800/80 rounded-lg text-xs text-slate-300 flex items-start justify-between gap-2 group"
                  >
                    {editingItem?.type === 'domain_rules' && editingItem.index === idx ? (
                      <div className="flex-1 space-y-1">
                        <textarea
                          rows={2}
                          value={editingItem.text}
                          onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
                          className="w-full p-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-1.5 py-0.5 text-[10px] text-slate-400"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-2 py-0.5 text-[10px] bg-sky-600 text-white rounded"
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
                            className="p-1 hover:text-sky-400 text-slate-400"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('domain_rules', idx)}
                            className="p-1 hover:text-rose-400 text-slate-400"
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

              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
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
                          className="w-full p-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-1.5 py-0.5 text-[10px] text-slate-400"
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
                            className="p-1 hover:text-rose-300 text-slate-400"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('safety_policies', idx)}
                            className="p-1 hover:text-rose-400 text-slate-400"
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

            {/* Section 3: Edge Cases & Boundaries (NOW FULLY VISIBLE & MANAGEABLE!) */}
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

              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
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
                          className="w-full p-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="px-1.5 py-0.5 text-[10px] text-slate-400"
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
                            className="p-1 hover:text-amber-300 text-slate-400"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('edge_cases', idx)}
                            className="p-1 hover:text-rose-400 text-slate-400"
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
              <div className="p-3 bg-slate-950 border border-sky-500/60 rounded-xl space-y-2 animate-in fade-in duration-200">
                <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                  Add New {addingType.replace('_', ' ').slice(0, -1)}
                </span>
                <textarea
                  rows={2}
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Enter criteria description..."
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <div className="flex justify-end gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => { setAddingType(null); setNewItemText(''); }}
                    className="px-2.5 py-1 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!newItemText.trim()}
                    onClick={handleAddItem}
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded font-medium"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Confirmation & Synthesis CTA */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Ambiguities resolved:</span>
              <span className={`font-mono font-bold ${allGapsAddressed ? 'text-emerald-400' : 'text-amber-400'}`}>
                {resolvedGaps.length + dismissedGaps.length} / {ambiguities.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmAndProceed}
              disabled={isLoading || !criteria}
              className={`w-full py-2.5 text-white font-medium text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                allGapsAddressed
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                  : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-50'
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
            <p className="text-[10px] text-center text-slate-500">
              {allGapsAddressed
                ? 'All identified edge cases are mapped to formal evaluation rules.'
                : `${unresolvedGaps.length} gap(s) open. You can resolve them or proceed with current criteria.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
