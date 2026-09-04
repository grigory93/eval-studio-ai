/**
 * REST and SSE API Client for EvalStudio AI Backend.
 */

import {
  RequirementDocModel,
  ElicitationChatResponse,
  ConfirmedCriteriaModel,
  EvalDatasetModel,
  EvalSampleModel,
  CompiledTaskResponse,
  ExecutiveScorecardReport,
} from '../types';

const BASE_URL = '/api';

export async function fetchHealth(): Promise<{ status: string; app: string }> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function uploadDocument(file: File): Promise<RequirementDocModel> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}/ingest/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function ingestRawText(title: string, text: string): Promise<RequirementDocModel> {
  const res = await fetch(`${BASE_URL}/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ingestion failed' }));
    throw new Error(err.detail || 'Ingestion failed');
  }
  return res.json();
}

export interface InitiateElicitationResponse {
  criteria: ConfirmedCriteriaModel;
  ambiguities: any[];
  reply: string;
  suggested_options: string[];
}

export async function initiateElicitation(
  docId: string,
  targetAgentPath: string = 'examples/customer_support_adk/agent.py:root_agent'
): Promise<InitiateElicitationResponse> {
  const res = await fetch(`${BASE_URL}/elicitation/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc_id: docId,
      target_agent_path: targetAgentPath,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to initiate elicitation' }));
    throw new Error(err.detail || 'Failed to initiate elicitation');
  }
  return res.json();
}

export async function sendElicitationMessage(
  sessionId: string,
  message: string,
  docId?: string,
  existingCriteria?: ConfirmedCriteriaModel
): Promise<ElicitationChatResponse> {
  const res = await fetch(`${BASE_URL}/elicitation/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      doc_id: docId,
      existing_criteria: existingCriteria,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Chat request failed' }));
    throw new Error(err.detail || 'Chat request failed');
  }
  return res.json();
}

export async function confirmCriteria(
  criteria: ConfirmedCriteriaModel
): Promise<ConfirmedCriteriaModel> {
  const res = await fetch(`${BASE_URL}/elicitation/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria),
  });
  if (!res.ok) throw new Error('Failed to confirm criteria');
  return res.json();
}

export async function updateCriteria(
  criteriaId: string,
  updates: Partial<ConfirmedCriteriaModel>
): Promise<ConfirmedCriteriaModel> {
  const res = await fetch(`${BASE_URL}/elicitation/criteria/${criteriaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update criteria');
  return res.json();
}

export async function resolveAmbiguity(
  criteriaId: string,
  findingId: string,
  resolution: string,
  createRule: boolean = true,
  ruleType: 'domain_rules' | 'edge_cases' | 'safety_policies' = 'domain_rules'
): Promise<ConfirmedCriteriaModel> {
  const res = await fetch(`${BASE_URL}/elicitation/criteria/${criteriaId}/ambiguities/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      finding_id: findingId,
      resolution,
      create_rule: createRule,
      rule_type: ruleType,
    }),
  });
  if (!res.ok) throw new Error('Failed to resolve ambiguity');
  return res.json();
}

export async function dismissAmbiguity(
  criteriaId: string,
  findingId: string
): Promise<ConfirmedCriteriaModel> {
  const res = await fetch(`${BASE_URL}/elicitation/criteria/${criteriaId}/ambiguities/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finding_id: findingId }),
  });
  if (!res.ok) throw new Error('Failed to dismiss ambiguity');
  return res.json();
}

export async function getSampleAgents(): Promise<Array<{ id: string; name: string; description: string; spec: string; tools: string[] }>> {
  const res = await fetch(`${BASE_URL}/ingest/sample-agents`);
  if (!res.ok) return [];
  return res.json();
}

export async function inspectAgent(spec: string): Promise<{ spec: string; valid: boolean; tools: string[]; error?: string }> {
  const res = await fetch(`${BASE_URL}/ingest/inspect-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec }),
  });
  if (!res.ok) throw new Error('Failed to inspect agent');
  return res.json();
}

export async function synthesizeDataset(payload: {
  use_case: string;
  domain_rules: string[];
  sample_count: number;
  confirmed_criteria_id?: string;
}): Promise<EvalDatasetModel> {
  const res = await fetch(`${BASE_URL}/dataset/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Dataset synthesis failed' }));
    throw new Error(err.detail || 'Dataset synthesis failed');
  }
  return res.json();
}

export async function updateSample(
  datasetId: string,
  sampleId: string,
  sample: Partial<EvalSampleModel>
): Promise<EvalSampleModel> {
  const res = await fetch(`${BASE_URL}/dataset/${datasetId}/samples/${sampleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sample),
  });
  if (!res.ok) throw new Error('Failed to update sample');
  return res.json();
}

export async function deleteSample(datasetId: string, sampleId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/dataset/${datasetId}/samples/${sampleId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete sample');
}

export async function compileTask(payload: {
  dataset_id: string;
  target_agent_path: string;
  task_name?: string;
  fail_on_error?: boolean;
}): Promise<CompiledTaskResponse> {
  const res = await fetch(`${BASE_URL}/eval/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Compilation failed' }));
    throw new Error(err.detail || 'Compilation failed');
  }
  return res.json();
}

export async function startEvaluation(payload: {
  task_id: string;
  dataset_id: string;
  target_agent_path: string;
}): Promise<{ eval_id: string; status: string }> {
  const res = await fetch(`${BASE_URL}/eval/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Evaluation start failed' }));
    throw new Error(err.detail || 'Evaluation start failed');
  }
  return res.json();
}

export async function getScorecardReport(evalId: string): Promise<ExecutiveScorecardReport> {
  const res = await fetch(`${BASE_URL}/scorecard/${evalId}`);
  if (!res.ok) throw new Error('Failed to load scorecard');
  return res.json();
}

export async function getComparativeReport(
  evalId: string,
  baselineId: string
): Promise<ExecutiveScorecardReport> {
  const res = await fetch(`${BASE_URL}/scorecard/${evalId}/compare/${baselineId}`);
  if (!res.ok) throw new Error('Failed to load comparative report');
  return res.json();
}
