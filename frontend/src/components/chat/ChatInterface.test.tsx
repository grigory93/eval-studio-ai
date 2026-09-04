import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from './ChatInterface';
import * as api from '../../services/api';
import { RequirementDocModel, ConfirmedCriteriaModel } from '../../types';

vi.mock('../../services/api', () => ({
  initiateElicitation: vi.fn(),
  sendElicitationMessage: vi.fn(),
  confirmCriteria: vi.fn(),
  updateCriteria: vi.fn(),
  resolveAmbiguity: vi.fn(),
  dismissAmbiguity: vi.fn(),
}));

describe('ChatInterface Component', () => {
  const sampleDoc: RequirementDocModel = {
    doc_id: 'doc-123',
    filename: 'refund_policy.md',
    sections: {
      'Returns': 'Returns accepted within 30 days of purchase.',
    },
  };

  const sampleCriteria: ConfirmedCriteriaModel = {
    criteria_id: 'crit-001',
    use_case: 'Refund Policy Testing',
    target_agent_description: 'Customer Support ADK Agent',
    target_agent_path: 'examples/customer_support_adk/agent.py:root_agent',
    domain_rules: ['Returns accepted within 30 days'],
    edge_cases: ['Item received damaged during shipping'],
    safety_policies: ['Strictly refuse unauthorized operations'],
    expected_tools: ['lookup_order', 'process_refund'],
    ambiguities: [
      {
        id: 'gap-01',
        category: 'Boundary Exception',
        description: 'Are refunds allowed for opened items received damaged in transit?',
        suggested_question: 'Should the agent permit a refund if packaging is broken upon arrival?',
        status: 'unresolved',
        resolved: false,
        suggested_options: ['Allow refund with photo proof', 'Strictly refuse opened items'],
      },
    ],
    evaluation_rubrics: {},
    is_confirmed: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.initiateElicitation as any).mockResolvedValue({
      criteria: sampleCriteria,
      reply: 'Hello! I analyzed your document. Please clarify edge cases.',
      suggested_options: ['Standard policy rules only', 'Escalate damaged items'],
    });
  });

  it('renders Step 3 badge and defaults to Detected Gaps tab', async () => {
    render(
      <ChatInterface
        doc={sampleDoc}
        onCriteriaConfirmed={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Step 3: Interactive Socratic Elicitation Workbench/i)).toBeDefined();
    });

    // Verify tabs
    expect(screen.getByText('Detected Gaps & Ambiguities')).toBeDefined();
    expect(screen.getByText('Socratic Chat Assistant')).toBeDefined();

    // Verify gap card content
    expect(screen.getByText('1 Open')).toBeDefined();
    expect(screen.getByText('Boundary Exception')).toBeDefined();
    expect(screen.getByText(/Are refunds allowed for opened items/i)).toBeDefined();
    expect(screen.getByText('Allow refund with photo proof')).toBeDefined();

    // Verify live confirmed criteria blueprint on the right
    expect(screen.getByText('Confirmed Evaluation Criteria')).toBeDefined();
    expect(screen.getByText('Returns accepted within 30 days')).toBeDefined();
  });

  it('switches to Socratic Chat Assistant tab and displays messages and quick-replies', async () => {
    render(
      <ChatInterface
        doc={sampleDoc}
        onCriteriaConfirmed={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Socratic Chat Assistant')).toBeDefined();
    });

    // Switch to Chat tab
    fireEvent.click(screen.getByText('Socratic Chat Assistant'));

    // Verify chat elements
    expect(screen.getByText('Hello! I analyzed your document. Please clarify edge cases.')).toBeDefined();
    expect(screen.getByText('Standard policy rules only')).toBeDefined();
    expect(screen.getByPlaceholderText(/Clarify an edge case/i)).toBeDefined();
  });

  it('resolves a gap via 1-click decision and updates criteria', async () => {
    const resolvedCriteria: ConfirmedCriteriaModel = {
      ...sampleCriteria,
      domain_rules: [...sampleCriteria.domain_rules, 'Allow refund with photo proof'],
      ambiguities: [
        {
          ...sampleCriteria.ambiguities![0],
          status: 'resolved',
          resolved: true,
          resolution: 'Allow refund with photo proof',
        },
      ],
    };

    (api.resolveAmbiguity as any).mockResolvedValue(resolvedCriteria);

    render(
      <ChatInterface
        doc={sampleDoc}
        onCriteriaConfirmed={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Allow refund with photo proof')).toBeDefined();
    });

    // Click 1-click decision option
    fireEvent.click(screen.getByText('Allow refund with photo proof'));

    await waitFor(() => {
      expect(api.resolveAmbiguity).toHaveBeenCalledWith(
        'crit-001',
        'gap-01',
        'Allow refund with photo proof',
        true,
        'domain_rules'
      );
    });
  });

  it('quick-adds a rule to criteria from chat options', async () => {
    const updatedCriteria: ConfirmedCriteriaModel = {
      ...sampleCriteria,
      domain_rules: [...sampleCriteria.domain_rules, 'Standard policy rules only'],
    };
    (api.updateCriteria as any).mockResolvedValue(updatedCriteria);

    render(
      <ChatInterface
        doc={sampleDoc}
        onCriteriaConfirmed={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Socratic Chat Assistant')).toBeDefined();
    });

    // Switch to Chat tab
    fireEvent.click(screen.getByText('Socratic Chat Assistant'));

    // Find "+ Criteria" button
    const addButtons = screen.getAllByText('+ Criteria');
    expect(addButtons.length).toBeGreaterThan(0);

    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(api.updateCriteria).toHaveBeenCalledWith('crit-001', {
        domain_rules: ['Returns accepted within 30 days', 'Standard policy rules only'],
      });
    });
  });

  it('triggers onCriteriaConfirmed when confirm button is clicked', async () => {
    const onConfirmed = vi.fn();
    (api.confirmCriteria as any).mockResolvedValue(sampleCriteria);

    render(
      <ChatInterface
        doc={sampleDoc}
        onCriteriaConfirmed={onConfirmed}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Confirm Criteria & Synthesize Dataset/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Confirm Criteria & Synthesize Dataset/i));

    await waitFor(() => {
      expect(onConfirmed).toHaveBeenCalledWith(sampleCriteria);
    });
  });
});
