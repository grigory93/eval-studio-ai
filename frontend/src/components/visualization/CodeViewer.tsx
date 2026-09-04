import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, FileCode, FileJson, Layers } from 'lucide-react';

interface CodeViewerProps {
  taskCode: string;
  samplesJson?: string;
  sampleCount?: number;
  filename?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  taskCode,
  samplesJson,
  sampleCount,
  filename = 'task.py',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'task' | 'samples'>('task');
  const [copied, setCopied] = useState(false);
  const [showFullScript, setShowFullScript] = useState(false);

  // Concise task code (~60 lines) replacing massive RAW_SAMPLES JSON block
  const conciseTaskCode = useMemo(() => {
    if (!taskCode) return '';
    const section3Header = '# =====================================================================\n# 3. Categorized Test Samples';
    const splitIndex = taskCode.indexOf(section3Header);
    if (splitIndex !== -1) {
      const topPart = taskCode.substring(0, splitIndex);
      const countLabel = sampleCount !== undefined ? `${sampleCount} Records` : 'Dataset Records';
      return `${topPart}# =====================================================================
# 3. Categorized Test Samples (${countLabel} Decoupled)
# =====================================================================
# Raw test records are cleanly decoupled into companion samples.json.
# Inspect or download the 'samples.json' tab to view individual test cases.
RAW_SAMPLES = [...]  # ${countLabel} in Inspect AI MemoryDataset format

if __name__ == "__main__":
    from inspect_ai import eval
    eval(...)
`;
    }
    return taskCode;
  }, [taskCode, sampleCount]);

  const activeContent = useMemo(() => {
    if (activeSubTab === 'samples') {
      return samplesJson || '[]';
    }
    return showFullScript ? taskCode : conciseTaskCode;
  }, [activeSubTab, showFullScript, taskCode, conciseTaskCode, samplesJson]);

  const activeFilename = activeSubTab === 'task' ? filename : 'samples.json';
  const activeMimeType = activeSubTab === 'task' ? 'text/x-python' : 'application/json';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // When downloading task.py, provide the complete self-contained runnable script
    const contentToDownload = activeSubTab === 'task' ? taskCode : (samplesJson || '[]');
    const blob = new Blob([contentToDownload], { type: activeMimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
      {/* File Sub-Tabs Navigation Bar */}
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* Tab 1: task.py */}
          <button
            type="button"
            onClick={() => setActiveSubTab('task')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
              activeSubTab === 'task'
                ? 'bg-slate-800 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{filename}</span>
            <span className="px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800/40 text-[10px] text-sky-300">
              Inspect Task
            </span>
          </button>

          {/* Tab 2: samples.json */}
          <button
            type="button"
            onClick={() => setActiveSubTab('samples')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-2 ${
              activeSubTab === 'samples'
                ? 'bg-slate-800 text-purple-400 border border-purple-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>samples.json</span>
            {sampleCount !== undefined && (
              <span className="px-1.5 py-0.2 rounded bg-purple-950 border border-purple-800/40 text-[10px] text-purple-300">
                {sampleCount} records
              </span>
            )}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeSubTab === 'task' && (
            <button
              type="button"
              onClick={() => setShowFullScript(!showFullScript)}
              className="px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-800 rounded border border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3 h-3 text-slate-500" />
              <span>{showFullScript ? 'Show Concise Task' : 'Show Full Inlined'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy {activeSubTab === 'task' ? 'Task Code' : 'JSON'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download {activeSubTab === 'task' ? '.py' : '.json'}
          </button>
        </div>
      </div>

      {/* Code / JSON Content Area */}
      <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[520px] overflow-y-auto selection:bg-sky-500 selection:text-white">
        <code>{activeContent}</code>
      </pre>
    </div>
  );
};
