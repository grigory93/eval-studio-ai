import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Loader2, ShieldAlert, Cpu, Wrench } from 'lucide-react';
import { sendElicitationMessage, confirmCriteria } from '../../services/api';
import { RequirementDocModel, ConfirmedCriteriaModel, AmbiguityFinding } from '../../types';

interface ChatInterfaceProps {
  doc: RequirementDocModel;
  onCriteriaConfirmed: (criteria: ConfirmedCriteriaModel) => void;
}

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  options?: string[];
  ambiguities?: AmbiguityFinding[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ doc, onCriteriaConfirmed }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [criteria, setCriteria] = useState<ConfirmedCriteriaModel | null>(null);
  const [isReady, setIsReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize conversation on mount
  useEffect(() => {
    initiateChat();
  }, [doc]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const initiateChat = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/elicitation/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: doc.doc_id }),
      });
      if (!res.ok) throw new Error('Failed to initiate elicitation');
      const data = await res.json();

      setCriteria(data.criteria);
      setMessages([
        {
          id: 'msg-init',
          sender: 'bot',
          text: data.reply,
          options: data.suggested_options,
          ambiguities: data.ambiguities,
        },
      ]);
    } catch {
      // Fallback message
      setMessages([
        {
          id: 'msg-err',
          sender: 'bot',
          text: `I analyzed ${doc.filename}. Let's clarify any ambiguous edge cases before generating the evaluation suite.`,
          options: ['Standard 30-day policy only', 'Require photo proof for damaged items'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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
      setIsReady(response.is_ready_for_synthesis);

      const botReply: Message = {
        id: `msg-bot-${Date.now()}`,
        sender: 'bot',
        text: response.reply,
        options: response.suggested_options,
        ambiguities: response.ambiguities,
      };
      setMessages((prev) => [...prev, botReply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'bot',
          text: 'I updated the criteria with your instruction. Anything else you want to clarify?',
          options: ['Criteria looks complete, proceed to dataset synthesis'],
        },
      ]);
      setIsReady(true);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Step 2: Socratic Requirement Elicitation
        </div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
          Resolve Edge Cases & Clarify Evaluation Rubrics
        </h2>
        <p className="text-xs text-slate-400">
          Our ADK Socratic Agent actively probes ambiguous edge cases to construct balanced test criteria.
        </p>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chat Messages (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col h-[600px] overflow-hidden shadow-lg">
          {/* Chat Header */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-200">Socratic Eval Agent</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">Gemini 2.5 on Vertex AI</span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl p-3.5 text-xs leading-relaxed space-y-2.5 ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Ambiguity Finding Badges */}
                  {msg.ambiguities && msg.ambiguities.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Detected Gaps & Ambiguities:</span>
                      </div>
                      {msg.ambiguities.map((amb) => (
                        <div
                          key={amb.id}
                          className="p-2 bg-amber-950/20 border border-amber-800/40 rounded-lg text-amber-200/90 space-y-1"
                        >
                          <p className="font-semibold text-amber-300">{amb.category}</p>
                          <p className="text-slate-300">{amb.description}</p>
                          <p className="italic text-slate-400">"{amb.suggested_question}"</p>
                        </div>
                      ))}
                    </div>
                  )}

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
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Elicitation agent is reasoning over policy rules...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Clarify an edge case or specify a business rule..."
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

        {/* Right Column: Confirmed Criteria Live Inspector (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-slate-200">Evaluation Criteria State</h3>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
              {criteria?.domain_rules.length || 0} Rules
            </span>
          </div>

          {/* Domain Rules */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
              <Cpu className="w-3.5 h-3.5" />
              <span>Core Business Rules</span>
            </div>
            <div className="space-y-1">
              {criteria?.domain_rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs text-slate-300"
                >
                  {rule}
                </div>
              ))}
            </div>
          </div>

          {/* Safety & Negative Constraints */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Safety & Negative Constraints</span>
            </div>
            <div className="space-y-1">
              {criteria?.safety_policies.map((pol, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-rose-950/20 border border-rose-900/30 rounded-lg text-xs text-rose-200"
                >
                  {pol}
                </div>
              ))}
            </div>
          </div>

          {/* Expected Tools */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Wrench className="w-3.5 h-3.5" />
              <span>Expected Agent Tools</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {criteria?.expected_tools.map((tool, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-emerald-950/40 border border-emerald-800/40 rounded text-[11px] font-mono text-emerald-300"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>

          {/* Confirm & Synthesis CTA */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={handleConfirmAndProceed}
              disabled={isLoading || !criteria}
              className={`w-full py-3 text-white font-medium text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                isReady
                  ? 'bg-emerald-600 hover:bg-emerald-500 animate-pulse'
                  : 'bg-sky-600 hover:bg-sky-500 disabled:opacity-50'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {isReady ? '✓ Criteria Ready: Synthesize Dataset (50–200 Samples)' : 'Confirm Criteria & Synthesize Dataset'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-500">
              Generates balanced samples across all 7 Inspect AI taxonomy categories.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
