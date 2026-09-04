import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { StepNavigator } from './components/layout/StepNavigator';
import { AgentSelector } from './components/agent/AgentSelector';
import { DocumentUploader } from './components/ingest/DocumentUploader';
import { ChatInterface } from './components/chat/ChatInterface';
import { DatasetGrid } from './components/dataset/DatasetGrid';
import { DualView } from './components/visualization/DualView';
import { LiveProgress } from './components/execution/LiveProgress';
import { ScorecardDashboard } from './components/scorecard/ScorecardDashboard';
import {
  RequirementDocModel,
  ConfirmedCriteriaModel,
  EvalDatasetModel,
  CompiledTaskResponse,
  ExecutiveScorecardReport,
} from './types';
import { synthesizeDataset, compileTask, startEvaluation } from './services/api';

export const App: React.FC = () => {
  // Wizard state machine (7 Steps)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);

  // Workflow artifact states
  const [doc, setDoc] = useState<RequirementDocModel | null>(null);
  const [targetAgentPath, setTargetAgentPath] = useState<string>('examples/customer_support_adk/agent.py:root_agent');
  const [, setCriteria] = useState<ConfirmedCriteriaModel | null>(null);
  const [dataset, setDataset] = useState<EvalDatasetModel | null>(null);
  const [compiledTask, setCompiledTask] = useState<CompiledTaskResponse | null>(null);
  const [activeEvalId, setActiveEvalId] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<ExecutiveScorecardReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const goToStep = (step: number) => {
    if (step <= maxStepReached) {
      setCurrentStep(step);
    }
  };

  const handleAgentSelected = (spec: string, _tools: string[]) => {
    setTargetAgentPath(spec);
    setCurrentStep(2);
    setMaxStepReached((prev) => Math.max(prev, 2));
  };

  const handleDocumentIngested = (ingestedDoc: RequirementDocModel, agentPath?: string) => {
    setDoc(ingestedDoc);
    if (agentPath) {
      setTargetAgentPath(agentPath);
    }
    setCurrentStep(3);
    setMaxStepReached((prev) => Math.max(prev, 3));
  };

  const handleCriteriaConfirmed = async (confirmedCriteria: ConfirmedCriteriaModel) => {
    setCriteria(confirmedCriteria);
    if (confirmedCriteria.target_agent_path) {
      setTargetAgentPath(confirmedCriteria.target_agent_path);
    }
    setIsProcessing(true);
    setGlobalError(null);

    try {
      // Synthesize 50 samples across all categories
      const synthesized = await synthesizeDataset({
        use_case: confirmedCriteria.use_case,
        domain_rules: confirmedCriteria.domain_rules,
        sample_count: 50,
        confirmed_criteria_id: confirmedCriteria.criteria_id,
      });

      setDataset(synthesized);
      setCurrentStep(4);
      setMaxStepReached((prev) => Math.max(prev, 4));
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to synthesize dataset');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedToTask = async (currentDataset: EvalDatasetModel) => {
    setDataset(currentDataset);
    setIsProcessing(true);
    setGlobalError(null);

    try {
      const compiled = await compileTask({
        dataset_id: currentDataset.id,
        target_agent_path: targetAgentPath,
        task_name: `eval_${currentDataset.name.toLowerCase().replace(/\s+/g, '_')}`,
        fail_on_error: false,
      });

      setCompiledTask(compiled);
      setCurrentStep(5);
      setMaxStepReached((prev) => Math.max(prev, 5));
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to compile Inspect AI task');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartExecution = async () => {
    if (!compiledTask || !dataset) return;
    setIsProcessing(true);
    setGlobalError(null);

    try {
      const { eval_id } = await startEvaluation({
        task_id: compiledTask.task_id,
        dataset_id: dataset.id,
        target_agent_path: compiledTask.config.target_agent_path,
      });

      setActiveEvalId(eval_id);
      setCurrentStep(6);
      setMaxStepReached((prev) => Math.max(prev, 6));
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to start evaluation runner');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEvaluationCompleted = (completedScorecard: ExecutiveScorecardReport) => {
    setScorecard(completedScorecard);
    setCurrentStep(7);
    setMaxStepReached((prev) => Math.max(prev, 7));
  };

  const handleReset = () => {
    if (confirm('Start a new evaluation workflow? Current progress will be reset.')) {
      setDoc(null);
      setCriteria(null);
      setDataset(null);
      setCompiledTask(null);
      setActiveEvalId(null);
      setScorecard(null);
      setCurrentStep(1);
      setMaxStepReached(1);
      setGlobalError(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Navigation Header */}
      <Header currentStep={currentStep} onReset={handleReset} />

      {/* Step Navigator Bar */}
      <StepNavigator
        currentStep={currentStep}
        maxStepReached={maxStepReached}
        onStepClick={goToStep}
      />

      {/* Global Error Toast */}
      {globalError && (
        <div className="max-w-4xl mx-auto mt-4 px-4 py-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-200 text-xs flex justify-between items-center">
          <span>{globalError}</span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="text-slate-400 hover:text-white font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Wizard Step Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 1 && (
          <AgentSelector
            initialSpec={targetAgentPath}
            onAgentSelected={handleAgentSelected}
          />
        )}

        {currentStep === 2 && (
          <DocumentUploader
            targetAgentPath={targetAgentPath}
            onDocumentIngested={handleDocumentIngested}
          />
        )}

        {currentStep === 3 && doc && (
          <ChatInterface
            doc={doc}
            targetAgentPath={targetAgentPath}
            onCriteriaConfirmed={handleCriteriaConfirmed}
          />
        )}

        {currentStep === 4 && dataset && (
          <DatasetGrid
            dataset={dataset}
            onProceedToTask={handleProceedToTask}
            onDatasetUpdate={(updated) => setDataset(updated)}
          />
        )}

        {currentStep === 5 && compiledTask && (
          <DualView
            compiledTask={compiledTask}
            onStartExecution={handleStartExecution}
            isExecuting={isProcessing}
          />
        )}

        {currentStep === 6 && activeEvalId && compiledTask && (
          <LiveProgress
            evalId={activeEvalId}
            taskName={compiledTask.task_name}
            onEvaluationCompleted={handleEvaluationCompleted}
            onCancel={() => setCurrentStep(5)}
          />
        )}

        {currentStep === 7 && scorecard && (
          <ScorecardDashboard
            scorecard={scorecard}
            onReEvaluate={() => setCurrentStep(5)}
          />
        )}
      </main>
    </div>
  );
};
