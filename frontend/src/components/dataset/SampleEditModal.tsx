import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { EvalSampleModel, EvalCategory } from '../../types';

interface SampleEditModalProps {
  sample: EvalSampleModel | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<EvalSampleModel>) => Promise<void>;
}

const CATEGORIES: EvalCategory[] = [
  'happy_path',
  'edge_case',
  'adversarial',
  'tool_usage',
  'exception',
  'policy_compliance',
  'multi_turn',
];

export const SampleEditModal: React.FC<SampleEditModalProps> = ({
  sample,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !sample) return null;

  const [inputVal, setInputVal] = useState<string>(
    typeof sample.input === 'string' ? sample.input : JSON.stringify(sample.input, null, 2)
  );
  const [targetVal, setTargetVal] = useState<string>(
    typeof sample.target === 'string' ? sample.target : JSON.stringify(sample.target, null, 2)
  );
  const [category, setCategory] = useState<EvalCategory>(sample.metadata.category);
  const [rubric, setRubric] = useState<string>(sample.metadata.grading_rubric || '');
  const [expectedTools, setExpectedTools] = useState<string>(
    (sample.metadata.expected_tools || []).join(', ')
  );
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    sample.metadata.difficulty || 'medium'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const tools = expectedTools
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await onSave({
        input: inputVal,
        target: targetVal,
        metadata: {
          ...sample.metadata,
          category,
          grading_rubric: rubric,
          expected_tools: tools,
          difficulty,
        },
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save sample');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-sky-400">{sample.id}</span>
            <h3 className="text-base font-bold text-white">Edit Evaluation Test Sample</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-950/50 border border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EvalCategory)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-sky-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-sky-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">User Input (Prompt)</label>
            <textarea
              rows={3}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Ground Truth Target</label>
            <textarea
              rows={3}
              value={targetVal}
              onChange={(e) => setTargetVal(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Grading Rubric (Judge Criteria)</label>
            <textarea
              rows={2}
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Expected Tools (comma separated)
            </label>
            <input
              type="text"
              value={expectedTools}
              onChange={(e) => setExpectedTools(e.target.value)}
              placeholder="e.g. lookup_order, process_refund"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-sky-500"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
