/**
 * TypeScript Data Contracts matching Backend Pydantic Models.
 */

export type EvalCategory =
  | 'happy_path'
  | 'edge_case'
  | 'adversarial'
  | 'tool_usage'
  | 'exception'
  | 'policy_compliance'
  | 'multi_turn';

export interface EvalSampleMetadata {
  category: EvalCategory;
  grading_rubric?: string;
  expected_tools?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  policy_rule_id?: string;
  custom_metadata?: Record<string, any>;
}

export interface EvalSampleModel {
  id: string;
  input: string | Array<Record<string, any>>;
  target: string | string[];
  choices?: string[];
  metadata: EvalSampleMetadata;
  sandbox?: string | [string, string];
  files?: Record<string, string>;
  setup?: string;
}

export interface EvalDatasetModel {
  id: string;
  name: string;
  description: string;
  samples: EvalSampleModel[];
  total_count: number;
  category_distribution: Record<string, number>;
}

export interface RequirementDocModel {
  doc_id: string;
  filename: string;
  content_type: string;
  extracted_text: string;
  sections: Record<string, string>;
  summary?: string;
  uploaded_at: string;
}

export interface AmbiguityFinding {
  id: string;
  category: string;
  description: string;
  suggested_question: string;
  resolved: boolean;
  resolution?: string;
}

export interface ConfirmedCriteriaModel {
  criteria_id: string;
  use_case: string;
  target_agent_description: string;
  domain_rules: string[];
  edge_cases: string[];
  safety_policies: string[];
  expected_tools: string[];
  evaluation_rubrics: Record<string, string>;
  is_confirmed: boolean;
}

export interface ElicitationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  clarification_options?: string[];
  ambiguities_detected?: AmbiguityFinding[];
}

export interface ElicitationChatResponse {
  session_id: string;
  reply: string;
  ambiguities: AmbiguityFinding[];
  suggested_options: string[];
  updated_criteria: ConfirmedCriteriaModel;
  is_ready_for_synthesis: boolean;
}

export interface ScorerConfig {
  scorer_type: string;
  name: string;
  rubric?: string;
  expected_tools?: string[];
  threshold?: number;
}

export interface InspectTaskConfig {
  task_name: string;
  dataset_id: string;
  target_agent_path: string;
  model_graded_judge_model: string;
  scorers: ScorerConfig[];
  fail_on_error: boolean;
  time_limit_seconds?: number;
  message_limit?: number;
}

export interface MermaidDiagramModel {
  diagram_code: string;
  title: string;
  description?: string;
  node_count: number;
}

export interface CompiledTaskResponse {
  task_id: string;
  task_name: string;
  task_code: string;
  mermaid_diagram: MermaidDiagramModel;
  config: InspectTaskConfig;
}

export interface MetricSummary {
  overall_pass_rate: number;
  category_pass_rates: Record<string, number>;
  policy_adherence_score: number;
  tool_selection_accuracy: number;
  total_samples: number;
  passed_samples: number;
  failed_samples: number;
  errored_samples: number;
  avg_latency_seconds: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_token_cost_usd: number;
}

export interface FailureCluster {
  cluster_id: string;
  title: string;
  category: string;
  description: string;
  failure_count: number;
  sample_ids: string[];
  root_cause: string;
  suggested_fix: string;
}

export interface SampleInspectionResult {
  sample_id: string;
  category: string;
  input: string;
  target: string;
  actual_output: string;
  score: number;
  passed: boolean;
  judge_reasoning: string;
  tool_calls_made: Array<Record<string, any>>;
  expected_tools?: string[];
  error_message?: string;
  full_transcript: Array<Record<string, any>>;
}

export interface ComparativeRunDelta {
  baseline_eval_id: string;
  baseline_timestamp: string;
  overall_pass_rate_delta: number;
  category_deltas: Record<string, number>;
  newly_failed_sample_ids: string[];
  newly_passed_sample_ids: string[];
}

export interface ExecutiveScorecardReport {
  eval_id: string;
  suite_id: string;
  task_name: string;
  timestamp: string;
  metrics: MetricSummary;
  comparative_delta?: ComparativeRunDelta;
  executive_summary: string;
  failure_clusters: FailureCluster[];
  actionable_recommendations: string[];
  sample_details: SampleInspectionResult[];
}

export interface EvalExecutionEvent {
  event: 'eval_started' | 'sample_progress' | 'sample_complete' | 'log_chunk' | 'eval_complete' | 'eval_error';
  eval_id: string;
  timestamp: string;
  progress_percent?: number;
  completed_samples?: number;
  total_samples?: number;
  current_sample_id?: string;
  current_category?: string;
  log_message?: string;
  scorecard?: ExecutiveScorecardReport;
  error?: string;
}
