import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScorecardDashboard } from './ScorecardDashboard';
import { ExecutiveScorecardReport } from '../../types';

describe('ScorecardDashboard Component', () => {
  const mockScorecard: ExecutiveScorecardReport = {
    eval_id: 'eval-test-999',
    suite_id: 'suite-001',
    task_name: 'eval_customer_support',
    timestamp: '2026-09-04 15:30:00',
    metrics: {
      overall_pass_rate: 0.75,
      category_pass_rates: {
        boundary_exception: 0.5,
        happy_path: 1.0,
      },
      policy_adherence_score: 0.9,
      tool_selection_accuracy: 0.85,
      total_samples: 4,
      passed_samples: 3,
      failed_samples: 1,
      errored_samples: 0,
      avg_latency_seconds: 1.2,
      total_input_tokens: 1500,
      total_output_tokens: 500,
      estimated_token_cost_usd: 0.005,
    },
    executive_summary: 'Evaluation completed with 75% overall pass rate.',
    failure_clusters: [],
    actionable_recommendations: ['Improve edge case handling in boundary exceptions'],
    sample_details: [
      {
        sample_id: 'sample-01',
        category: 'happy_path',
        input: 'I want to track my order #12345',
        target: 'Order #12345 is in transit.',
        actual_output: 'Order #12345 is in transit.',
        score: 1.0,
        passed: true,
        judge_reasoning: 'Correct lookup and response.',
        tool_calls_made: [{ tool: 'lookup_order' }],
        full_transcript: [],
      },
      {
        sample_id: 'sample-02',
        category: 'happy_path',
        input: 'Where is package #67890',
        target: 'Package #67890 delivered.',
        actual_output: 'Package #67890 delivered.',
        score: 1.0,
        passed: true,
        judge_reasoning: 'Accurate tool invocation.',
        tool_calls_made: [{ tool: 'lookup_order' }],
        full_transcript: [],
      },
      {
        sample_id: 'sample-03',
        category: 'boundary_exception',
        input: 'Refund broken item after 45 days',
        target: 'Refuse refund beyond 30 days.',
        actual_output: 'Refuse refund beyond 30 days.',
        score: 1.0,
        passed: true,
        judge_reasoning: 'Policy correctly adhered to.',
        tool_calls_made: [],
        full_transcript: [],
      },
      {
        sample_id: 'sample-04',
        category: 'boundary_exception',
        input: 'Refund opened perishable without receipt',
        target: 'Deny refund without receipt.',
        actual_output: 'Refund granted.',
        score: 0.0,
        passed: false,
        judge_reasoning: 'Agent violated refusal policy.',
        tool_calls_made: [{ tool: 'process_refund' }],
        full_transcript: [],
      },
    ],
  };

  it('renders Step 7 badge and displays all samples by default', () => {
    render(<ScorecardDashboard scorecard={mockScorecard} onReEvaluate={vi.fn()} />);

    expect(screen.getByText(/Step 7: Executive Evaluation Scorecard & Diagnostics/i)).toBeDefined();
    expect(screen.getByText(/eval_customer_support Scorecard/i)).toBeDefined();
    expect(screen.getByText('All (4)')).toBeDefined();
    expect(screen.getByText('Passed (3)')).toBeDefined();
    expect(screen.getByText('Failed (1)')).toBeDefined();
    expect(screen.getByText('sample-01')).toBeDefined();
    expect(screen.getByText('sample-04')).toBeDefined();
  });

  it('filters sample execution table by clicking category distribution bar', () => {
    render(<ScorecardDashboard scorecard={mockScorecard} onReEvaluate={vi.fn()} />);

    // Click on boundary_exception bar
    const boundaryElements = screen.getAllByText('boundary_exception');
    fireEvent.click(boundaryElements[0]);

    // Active category filter chip should appear
    expect(screen.getByText(/Category:/i)).toBeDefined();
    expect(screen.getByLabelText(/Clear category filter/i)).toBeDefined();

    // Counts should update dynamically within boundary_exception (1 pass, 1 fail = 2 total)
    expect(screen.getByText('All (2)')).toBeDefined();
    expect(screen.getByText('Passed (1)')).toBeDefined();
    expect(screen.getByText('Failed (1)')).toBeDefined();

    // Table should only show sample-03 and sample-04
    expect(screen.queryByText('sample-01')).toBeNull();
    expect(screen.queryByText('sample-02')).toBeNull();
    expect(screen.getByText('sample-03')).toBeDefined();
    expect(screen.getByText('sample-04')).toBeDefined();
  });

  it('clears category filter when clicking the X on the filter chip', () => {
    render(<ScorecardDashboard scorecard={mockScorecard} onReEvaluate={vi.fn()} />);

    // Select category
    const boundaryElements = screen.getAllByText('boundary_exception');
    fireEvent.click(boundaryElements[0]);
    expect(screen.queryByText('sample-01')).toBeNull();

    // Clear filter
    const clearBtn = screen.getByLabelText(/Clear category filter/i);
    fireEvent.click(clearBtn);

    // Full list restored
    expect(screen.getByText('All (4)')).toBeDefined();
    expect(screen.getByText('sample-01')).toBeDefined();
    expect(screen.getByText('sample-02')).toBeDefined();
  });

  it('multiplicatively filters by category and failed status', () => {
    render(<ScorecardDashboard scorecard={mockScorecard} onReEvaluate={vi.fn()} />);

    // Select boundary_exception
    const boundaryElements = screen.getAllByText('boundary_exception');
    fireEvent.click(boundaryElements[0]);

    // Click "Failed (1)"
    fireEvent.click(screen.getByText('Failed (1)'));

    // Should only show sample-04 (failed boundary_exception)
    expect(screen.queryByText('sample-03')).toBeNull();
    expect(screen.getByText('sample-04')).toBeDefined();
  });

  it('triggers onReEvaluate callback when button clicked', () => {
    const onReEval = vi.fn();
    render(<ScorecardDashboard scorecard={mockScorecard} onReEvaluate={onReEval} />);

    fireEvent.click(screen.getByText(/Re-Evaluate Suite/i));
    expect(onReEval).toHaveBeenCalledTimes(1);
  });
});
