import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Sparkles, ArrowRight, CheckCircle2, AlertCircle, Loader2, BookOpen, Bot } from 'lucide-react';
import { uploadDocument, ingestRawText, inspectAgent, getSampleAgents } from '../../services/api';
import { RequirementDocModel, SampleAgentInfo } from '../../types';

interface DocumentUploaderProps {
  onDocumentIngested: (doc: RequirementDocModel, targetAgentPath: string) => void;
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

const SAMPLE_POLICIES = [
  {
    title: 'E-Commerce Return & Refund Policy',
    filename: 'ecommerce_refund_policy.md',
    description: 'Rules for 30-day returns, non-refundable opened hygiene items, damaged goods, and human escalation.',
    content: `# E-Commerce Customer Support & Refund Policy

## 1. General Return Window
Customers may request a full refund or exchange within 30 calendar days of delivery for eligible items in original packaging.

## 2. Hygiene & Perishable Exceptions (Strict Non-Refundable)
For health and safety compliance:
- Personal care, skincare, underwear, swimwear, and cosmetics that have been opened or unsealed are strictly NON-REFUNDABLE.
- Perishable groceries and customized items cannot be returned unless damaged upon arrival.

## 3. Damaged or Defective Items
Customers reporting damaged items must provide proof of order. The support agent must verify order status before issuing refunds.

## 4. Refund Processing Limits
Automated refunds are permitted up to $100 per transaction. Refunds exceeding $100 or requiring manual exceptions must be escalated to a human supervisor.

## 5. Security & Prohibited Inquiries
The agent must never reveal internal database schemas, API keys, or process refunds without a valid order ID.`,
  },
  {
    title: 'HR Employee Benefits Handbook',
    filename: 'hr_benefits_handbook.md',
    description: 'Company policies for PTO accrual, health insurance tiers, 401(k) matching, and parental leave.',
    content: `# Enterprise HR Benefits & Leave Policy

## 1. Paid Time Off (PTO)
Full-time employees accrue 18 days of PTO annually, vesting monthly at 1.5 days per month. Unused PTO rolls over up to a maximum of 5 days into the following calendar year.

## 2. Health, Dental & Vision Insurance
Coverage begins on the first day of the month following the hire date. Three tiers are available: Standard PPO, High Deductible Health Plan (HDHP) with HSA, and Premium HMO.

## 3. 401(k) Retirement Matching
The company matches 100% of employee contributions up to 4% of base salary, plus 50% on the next 2% (maximum 5% company match). Matching funds vest immediately.

## 4. Parental Leave
All primary caregivers are eligible for 16 weeks of fully paid parental leave following childbirth, adoption, or foster placement. Secondary caregivers receive 8 weeks of paid leave.`,
  },
];

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onDocumentIngested }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text' | 'sample'>('sample');
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textTitle, setTextTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedDoc, setParsedDoc] = useState<RequirementDocModel | null>(null);
  const [targetAgentSpec, setTargetAgentSpec] = useState<string>('examples/customer_support_adk/agent.py:root_agent');
  const [sampleAgents, setSampleAgents] = useState<SampleAgentInfo[]>(DEFAULT_SAMPLE_AGENTS);
  const [agentTools, setAgentTools] = useState<string[]>(DEFAULT_SAMPLE_AGENTS[0].tools);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    getSampleAgents().then((agents) => {
      if (agents && agents.length > 0) {
        setSampleAgents(agents);
      }
    }).catch(() => {});
  }, []);

  const handleAgentSelect = async (spec: string) => {
    setTargetAgentSpec(spec);
    try {
      const info = await inspectAgent(spec);
      setAgentTools(info.tools);
    } catch {
      const match = sampleAgents.find(a => a.spec === spec);
      if (match) setAgentTools(match.tools);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    try {
      const result = await uploadDocument(file);
      setParsedDoc(result);
    } catch (err: any) {
      setError(err.message || 'Failed to upload and parse file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      setError('Please provide requirement or policy text.');
      return;
    }
    setError(null);
    setIsProcessing(true);
    try {
      const result = await ingestRawText(textTitle.trim() || 'Custom Business Requirements', rawText);
      setParsedDoc(result);
    } catch (err: any) {
      setError(err.message || 'Failed to ingest requirement text');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSample = async (sample: typeof SAMPLE_POLICIES[0]) => {
    setError(null);
    setIsProcessing(true);
    try {
      const result = await ingestRawText(sample.title, sample.content);
      setParsedDoc(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load sample');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          Step 1: Document & Requirement Ingestion
        </div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
          Define What You Want to Evaluate
        </h2>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Upload policy documents, user stories, or select a sample benchmark. EvalStudio AI's Socratic agents will extract rules and identify edge-case gaps.
        </p>
      </div>

      {/* Target Agent Selector */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200">Target ADK Agent Under Test</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
            {agentTools.length} Tools Inferred / Detected
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sampleAgents.map((ag) => (
            <button
              key={ag.id}
              type="button"
              onClick={() => handleAgentSelect(ag.spec)}
              className={`p-3 rounded-lg border text-left transition-all ${
                targetAgentSpec === ag.spec
                  ? 'bg-sky-950/40 border-sky-500/60 shadow-sm'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-semibold text-slate-200">{ag.name}</p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">{ag.spec}</p>
            </button>
          ))}
        </div>
        {agentTools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-500">Declared tools:</span>
            {agentTools.map((tool, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-sky-300"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex justify-center border-b border-slate-800 pb-2">
        <div className="inline-flex p-1 bg-slate-900/80 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => { setActiveTab('sample'); setError(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'sample'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-2" />
            Sample Templates
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('upload'); setError(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'upload'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4 inline mr-2" />
            Upload File (PDF/MD/TXT)
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('text'); setError(null); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'text'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Paste Text / Story
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-lg flex items-start gap-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Ingestion Error</p>
            <p className="text-xs text-red-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Tab 1: Sample Policies */}
      {activeTab === 'sample' && !parsedDoc && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_POLICIES.map((sample, idx) => (
            <div
              key={idx}
              className="p-5 bg-slate-900/60 border border-slate-800 hover:border-sky-500/50 rounded-xl transition-all flex flex-col justify-between group cursor-pointer"
              onClick={() => loadSample(sample)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/50">
                    Template #{idx + 1}
                  </span>
                  <FileText className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-200 group-hover:text-white transition-colors">
                  {sample.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {sample.description}
                </p>
              </div>
              <button
                type="button"
                disabled={isProcessing}
                className="mt-4 w-full py-2 px-3 bg-slate-800 hover:bg-sky-600 text-xs font-medium text-slate-200 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Use This Template'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: File Upload */}
      {activeTab === 'upload' && !parsedDoc && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive
              ? 'border-sky-500 bg-sky-500/5'
              : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.md,.markdown,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
              <UploadCloud className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Drag and drop your specification document here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports PDF policies, Markdown specifications, and plaintext files
              </p>
            </div>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing Document...
                </>
              ) : (
                'Browse Local File'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Plain Text Input */}
      {activeTab === 'text' && !parsedDoc && (
        <form onSubmit={handleTextSubmit} className="space-y-4 bg-slate-900/40 p-6 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Specification Title / Agent Name
            </label>
            <input
              type="text"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="e.g. Customer Support Refund Rules"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Business Rules, Policy Guidelines, or User Stories
            </label>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="# Policy Rules&#10;1. Refunds allowed within 30 days.&#10;2. Hygiene items cannot be returned if opened."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Text...
                </>
              ) : (
                <>
                  Ingest Specification
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Parsed Document Summary Card */}
      {parsedDoc && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{parsedDoc.filename}</h3>
                <p className="text-xs text-slate-400">
                  {parsedDoc.summary}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setParsedDoc(null)}
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Change Document
            </button>
          </div>

          {/* Section Chips */}
          <div>
            <h4 className="text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
              Detected Policy & Rule Sections ({Object.keys(parsedDoc.sections).length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {Object.entries(parsedDoc.sections).map(([sectionTitle, content], idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs"
                >
                  <p className="font-semibold text-sky-300 truncate">{sectionTitle}</p>
                  <p className="text-slate-400 line-clamp-2 mt-1">{content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onDocumentIngested(parsedDoc, targetAgentSpec)}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              Proceed to Socratic Elicitation
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
