import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  Wrench,
} from 'lucide-react';
import { EvalDatasetModel, EvalSampleModel, EvalCategory } from '../../types';
import { SampleEditModal } from './SampleEditModal';
import { updateSample, deleteSample } from '../../services/api';

interface DatasetGridProps {
  dataset: EvalDatasetModel;
  onProceedToTask: (dataset: EvalDatasetModel) => void;
  onDatasetUpdate: (updatedDataset: EvalDatasetModel) => void;
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

function getCategoryBadgeClass(category: EvalCategory): string {
  switch (category) {
    case 'happy_path':
      return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
    case 'edge_case':
      return 'bg-amber-950/40 text-amber-300 border-amber-800/50';
    case 'adversarial':
      return 'bg-rose-950/40 text-rose-300 border-rose-800/50';
    case 'tool_usage':
      return 'bg-purple-950/40 text-purple-300 border-purple-800/50';
    case 'exception':
      return 'bg-orange-950/40 text-orange-300 border-orange-800/50';
    case 'policy_compliance':
      return 'bg-blue-950/40 text-blue-300 border-blue-800/50';
    case 'multi_turn':
      return 'bg-indigo-950/40 text-indigo-300 border-indigo-800/50';
    default:
      return 'bg-slate-900 text-slate-300 border-slate-700';
  }
}

function getDifficultyBadgeClass(difficulty?: string): string {
  if (difficulty === 'hard') return 'text-rose-400 bg-rose-950/40';
  if (difficulty === 'medium') return 'text-amber-400 bg-amber-950/40';
  return 'text-emerald-400 bg-emerald-950/40';
}

export const DatasetGrid: React.FC<DatasetGridProps> = ({
  dataset,
  onProceedToTask,
  onDatasetUpdate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingSample, setEditingSample] = useState<EvalSampleModel | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Filter samples by category and search query
  const filteredSamples = dataset.samples.filter((s) => {
    const matchesCat = selectedCategory === 'all' || s.metadata.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const inputStr = typeof s.input === 'string' ? s.input : JSON.stringify(s.input);
    const targetStr = typeof s.target === 'string' ? s.target : JSON.stringify(s.target);
    const matchesSearch =
      !q ||
      s.id.toLowerCase().includes(q) ||
      inputStr.toLowerCase().includes(q) ||
      targetStr.toLowerCase().includes(q) ||
      (s.metadata.grading_rubric && s.metadata.grading_rubric.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const handleEditClick = (sample: EvalSampleModel) => {
    setEditingSample(sample);
    setIsEditModalOpen(true);
  };

  const handleSaveSample = async (updated: Partial<EvalSampleModel>) => {
    if (!editingSample) return;
    try {
      const saved = await updateSample(dataset.id, editingSample.id, updated);
      const newSamples = dataset.samples.map((s) => (s.id === saved.id ? saved : s));
      const updatedDataset: EvalDatasetModel = {
        ...dataset,
        samples: newSamples,
      };
      onDatasetUpdate(updatedDataset);
    } catch {
      const newSamples = dataset.samples.map((s) =>
        s.id === editingSample.id ? ({ ...s, ...updated } as EvalSampleModel) : s
      );
      onDatasetUpdate({ ...dataset, samples: newSamples });
    }
  };

  const handleDeleteClick = async (sampleId: string) => {
    if (!confirm('Are you sure you want to delete this test sample?')) return;
    try {
      await deleteSample(dataset.id, sampleId);
      const newSamples = dataset.samples.filter((s) => s.id !== sampleId);
      onDatasetUpdate({
        ...dataset,
        samples: newSamples,
        total_count: newSamples.length,
      });
    } catch {
      const newSamples = dataset.samples.filter((s) => s.id !== sampleId);
      onDatasetUpdate({ ...dataset, samples: newSamples, total_count: newSamples.length });
    }
  };

  const handleAddNewSample = () => {
    const newId = `sample-${dataset.samples.length + 1}`;
    const newSample: EvalSampleModel = {
      id: newId,
      input: 'New custom user query prompt',
      target: 'Expected ideal outcome or refusal response',
      metadata: {
        category: 'happy_path',
        grading_rubric: 'Verify compliance with requirements.',
        expected_tools: ['lookup_order'],
        difficulty: 'medium',
      },
    };
    setEditingSample(newSample);
    setIsEditModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Meta Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Step 4: Synthesized Dataset Matrix
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-sky-400" />
            {dataset.name}
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-0.5">
            {dataset.description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddNewSample}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom Sample
          </button>
          <button
            type="button"
            onClick={() => onProceedToTask(dataset)}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-md flex items-center gap-2 transition-all"
          >
            Proceed to Task Compilation ({dataset.samples.length} Samples)
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Filter Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            selectedCategory === 'all'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          All Categories ({dataset.samples.length})
        </button>

        {CATEGORIES.map((cat) => {
          const count = dataset.category_distribution[cat] || 0;
          const isSelected = selectedCategory === cat;
          const badgeClass = getCategoryBadgeClass(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? `${badgeClass} ring-1 ring-sky-500`
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{cat}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-950/80 text-[10px] font-mono">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar & Stats */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompt, target, rubric, or sample ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          />
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Showing {filteredSamples.length} of {dataset.samples.length} test samples
        </span>
      </div>

      {/* Interactive Data Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-400 sticky top-0 z-10 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 w-28">Sample ID</th>
                <th className="py-3 px-4 w-36">Category</th>
                <th className="py-3 px-4">User Prompt / Input</th>
                <th className="py-3 px-4">Target Ground Truth</th>
                <th className="py-3 px-4 w-48">Expected Tools & Rubric</th>
                <th className="py-3 px-4 w-20 text-center">Difficulty</th>
                <th className="py-3 px-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSamples.map((sample) => {
                const categoryClass = getCategoryBadgeClass(sample.metadata.category);
                const difficultyClass = getDifficultyBadgeClass(sample.metadata.difficulty);
                const inputPreview =
                  typeof sample.input === 'string'
                    ? sample.input
                    : JSON.stringify(sample.input);
                const targetPreview =
                  typeof sample.target === 'string'
                    ? sample.target
                    : JSON.stringify(sample.target);

                return (
                  <tr key={sample.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* ID */}
                    <td className="py-3 px-4 font-mono text-sky-400 font-medium">
                      {sample.id}
                    </td>

                    {/* Category Badge */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryClass}`}
                      >
                        {sample.metadata.category}
                      </span>
                    </td>

                    {/* Input */}
                    <td className="py-3 px-4 text-slate-200 max-w-xs truncate" title={inputPreview}>
                      {inputPreview}
                    </td>

                    {/* Target */}
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={targetPreview}>
                      {targetPreview}
                    </td>

                    {/* Tools & Rubric */}
                    <td className="py-3 px-4 space-y-1">
                      {sample.metadata.expected_tools && sample.metadata.expected_tools.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {sample.metadata.expected_tools.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 bg-purple-950/40 border border-purple-800/40 text-purple-300 rounded font-mono text-[9px] flex items-center gap-0.5"
                            >
                              <Wrench className="w-2.5 h-2.5" />
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {sample.metadata.grading_rubric && (
                        <p className="text-[10px] text-slate-500 truncate" title={sample.metadata.grading_rubric}>
                          {sample.metadata.grading_rubric}
                        </p>
                      )}
                    </td>

                    {/* Difficulty */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${difficultyClass}`}
                      >
                        {sample.metadata.difficulty || 'medium'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleEditClick(sample)}
                        className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors"
                        title="Edit Sample"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(sample.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        title="Delete Sample"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <SampleEditModal
        sample={editingSample}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSample(null);
        }}
        onSave={handleSaveSample}
      />
    </div>
  );
};
