import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface MermaidViewerProps {
  chart: string;
}

export const MermaidViewer: React.FC<MermaidViewerProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      themeVariables: {
        darkMode: true,
        background: '#090d16',
        primaryColor: '#0284c7',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#38bdf8',
        lineColor: '#38bdf8',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        actorBkg: '#0f172a',
        actorBorder: '#0284c7',
        actorTextColor: '#f8fafc',
        signalColor: '#38bdf8',
        signalTextColor: '#f8fafc',
        noteBkgColor: '#1e293b',
        noteTextColor: '#f8fafc',
        noteBorderColor: '#334155',
      },
    });

    const renderDiagram = async () => {
      if (!chart.trim()) return;
      try {
        setRenderError(null);
        const id = `mermaid-svg-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        setSvgContent(svg);
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        setRenderError('Could not render visual diagram. You can view the raw definition below.');
      }
    };

    renderDiagram();
  }, [chart]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      {renderError ? (
        <div className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>Diagram Preview Fallback</span>
          </div>
          <pre className="p-4 bg-slate-950 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
            {chart}
          </pre>
        </div>
      ) : svgContent ? (
        <div
          ref={containerRef}
          className="w-full flex justify-center overflow-x-auto py-4"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      ) : (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-8">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Rendering Architecture Sequence Diagram...</span>
        </div>
      )}
    </div>
  );
};
