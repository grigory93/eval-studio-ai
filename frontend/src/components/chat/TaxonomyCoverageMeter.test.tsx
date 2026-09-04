import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaxonomyCoverageMeter } from './TaxonomyCoverageMeter';
import { EvaluationSeed } from '../../types';

describe('TaxonomyCoverageMeter Component', () => {
  const sampleSeeds: EvaluationSeed[] = [
    {
      seed_id: 's1',
      category: 'happy_path',
      scenario_intent: 'Standard return within 30 days',
      sample_input: 'I want to return my order 123',
      expected_target: 'Generate return label',
      grading_rubric: 'Agent generates return label',
      status: 'accepted',
    },
    {
      seed_id: 's2',
      category: 'happy_path',
      scenario_intent: 'Standard return exchange',
      sample_input: 'Exchange item',
      expected_target: 'Initiate exchange',
      grading_rubric: 'Agent initiates exchange',
      status: 'accepted',
    },
    {
      seed_id: 's3',
      category: 'edge_case',
      scenario_intent: 'Item returned on day 30 at 11:59pm',
      sample_input: 'Can I return right at deadline?',
      expected_target: 'Accept within deadline',
      grading_rubric: 'Agent accepts on day 30',
      status: 'proposed',
    },
  ];

  it('renders coverage engine header and counts accepted seeds', () => {
    render(
      <TaxonomyCoverageMeter
        seeds={sampleSeeds}
        coverageScores={{ happy_path: 0.66, edge_case: 0.15 }}
      />
    );

    expect(screen.getByText('Taxonomy Coverage Engine')).toBeDefined();
    expect(screen.getByText('2 Accepted Seeds')).toBeDefined();
    expect(screen.getByText('Happy Path')).toBeDefined();
    expect(screen.getByText('Edge Cases')).toBeDefined();
    expect(screen.getByText('Adversarial / Red Team')).toBeDefined();
    expect(screen.getByText('Tool Usage & Schema')).toBeDefined();
    expect(screen.getByText('Exceptions & Fallbacks')).toBeDefined();
    expect(screen.getByText('Safety & Compliance')).toBeDefined();
    expect(screen.getByText('Multi-Turn & State')).toBeDefined();
  });

  it('triggers onDeepDive when Deep-Dive button is clicked', () => {
    const handleDeepDive = vi.fn();
    render(
      <TaxonomyCoverageMeter
        seeds={sampleSeeds}
        onDeepDive={handleDeepDive}
      />
    );

    const deepDiveButtons = screen.getAllByRole('button', { name: /deep-dive/i });
    expect(deepDiveButtons.length).toBeGreaterThan(0);
    fireEvent.click(deepDiveButtons[0]);

    expect(handleDeepDive).toHaveBeenCalledWith('happy_path');
  });

  it('triggers onSelectCategory when category tile is clicked', () => {
    const handleSelectCategory = vi.fn();
    render(
      <TaxonomyCoverageMeter
        seeds={sampleSeeds}
        onSelectCategory={handleSelectCategory}
      />
    );

    fireEvent.click(screen.getByText('Edge Cases'));
    expect(handleSelectCategory).toHaveBeenCalledWith('edge_case');
  });
});
