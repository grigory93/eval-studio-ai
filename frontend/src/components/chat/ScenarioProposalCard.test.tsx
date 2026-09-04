import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioProposalCard } from './ScenarioProposalCard';
import { EvaluationSeed } from '../../types';

describe('ScenarioProposalCard Component', () => {
  const sampleSeed: EvaluationSeed = {
    seed_id: 'seed-test-01',
    category: 'edge_case',
    source_clause_id: 'SEC-01',
    scenario_intent: 'Test damaged item return past 30 days',
    sample_input: 'Can I return an item I received broken 35 days ago?',
    expected_target: 'Politely refuse automatic return, offer escalation to warranty support',
    grading_rubric: 'Agent must cite the 30-day window and offer warranty escalation',
    expected_tools: ['lookup_order', 'check_warranty'],
    difficulty: 'medium',
    status: 'proposed',
  };

  it('renders seed details, category, clause badge and sample prompt', () => {
    render(
      <ScenarioProposalCard
        seed={sampleSeed}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText('Edge Cases')).toBeDefined();
    expect(screen.getByText('§ SEC-01')).toBeDefined();
    expect(screen.getByText('Test damaged item return past 30 days')).toBeDefined();
    expect(screen.getByText('Can I return an item I received broken 35 days ago?')).toBeDefined();
    expect(screen.getByText(/Politely refuse automatic return/i)).toBeDefined();
    expect(screen.getByText('Accept into Blueprint')).toBeDefined();
  });

  it('triggers onAccept when Accept into Blueprint button is clicked', () => {
    const handleAccept = vi.fn();
    render(
      <ScenarioProposalCard
        seed={sampleSeed}
        onAccept={handleAccept}
        onDismiss={vi.fn()}
      />
    );

    const acceptButtons = screen.getAllByRole('button', { name: /accept/i });
    fireEvent.click(acceptButtons[0]);

    expect(handleAccept).toHaveBeenCalledWith(sampleSeed);
  });

  it('triggers onDismiss when dismiss button is clicked', () => {
    const handleDismiss = vi.fn();
    render(
      <ScenarioProposalCard
        seed={sampleSeed}
        onAccept={vi.fn()}
        onDismiss={handleDismiss}
      />
    );

    const dismissButton = screen.getByTitle('Dismiss proposed seed');
    fireEvent.click(dismissButton);

    expect(handleDismiss).toHaveBeenCalledWith('seed-test-01');
  });

  it('renders accepted badge when status is accepted', () => {
    const acceptedSeed: EvaluationSeed = { ...sampleSeed, status: 'accepted' };
    render(
      <ScenarioProposalCard
        seed={acceptedSeed}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByText('✓ In Blueprint')).toBeDefined();
  });
});
