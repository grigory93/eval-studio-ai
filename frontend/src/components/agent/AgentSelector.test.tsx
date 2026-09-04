import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentSelector } from './AgentSelector';
import * as api from '../../services/api';

describe('AgentSelector Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pre-configured sample agent cards and heading', async () => {
    vi.spyOn(api, 'getSampleAgents').mockResolvedValueOnce([
      {
        id: 'customer-support',
        name: 'Customer Support ADK Agent',
        description: 'E-commerce refund and order management agent',
        spec: 'examples/customer_support_adk/agent.py:root_agent',
        tools: ['lookup_order', 'process_refund'],
      },
      {
        id: 'hr-benefits',
        name: 'HR Benefits ADK Agent',
        description: 'Enterprise HR employee policy advisor',
        spec: 'examples/hr_benefits_adk/agent.py:root_agent',
        tools: ['lookup_employee_pto'],
      },
    ]);

    const onSelectMock = vi.fn();
    render(<AgentSelector onAgentSelected={onSelectMock} />);

    expect(screen.getByText('Select or Specify the Agent Under Test')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('Customer Support ADK Agent')).toBeDefined();
      expect(screen.getByText('HR Benefits ADK Agent')).toBeDefined();
    });
  });

  it('calls onAgentSelected with spec and tools when clicking proceed', async () => {
    vi.spyOn(api, 'getSampleAgents').mockResolvedValueOnce([
      {
        id: 'customer-support',
        name: 'Customer Support ADK Agent',
        description: 'E-commerce refund agent',
        spec: 'examples/customer_support_adk/agent.py:root_agent',
        tools: ['lookup_order', 'process_refund'],
      },
    ]);
    vi.spyOn(api, 'inspectAgent').mockResolvedValueOnce({
      spec: 'examples/customer_support_adk/agent.py:root_agent',
      valid: true,
      tools: ['lookup_order', 'process_refund'],
    });

    const onSelectMock = vi.fn();
    render(
      <AgentSelector
        initialSpec="examples/customer_support_adk/agent.py:root_agent"
        onAgentSelected={onSelectMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Customer Support ADK Agent')).toBeDefined();
    });

    const proceedBtn = screen.getByRole('button', { name: /Proceed to Specification Ingestion/i });
    fireEvent.click(proceedBtn);

    expect(onSelectMock).toHaveBeenCalledWith(
      'examples/customer_support_adk/agent.py:root_agent',
      expect.arrayContaining(['lookup_order', 'process_refund'])
    );
  });

  it('allows inspecting a custom local agent entrypoint', async () => {
    vi.spyOn(api, 'inspectAgent').mockResolvedValueOnce({
      spec: 'custom/agent.py:root_agent',
      valid: true,
      tools: ['custom_tool_a'],
    });

    const onSelectMock = vi.fn();
    render(<AgentSelector onAgentSelected={onSelectMock} />);

    const input = screen.getByPlaceholderText(/examples\/customer_support_adk/i);
    fireEvent.change(input, { target: { value: 'custom/agent.py:root_agent' } });

    const inspectBtn = screen.getByRole('button', { name: /Inspect Agent/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(api.inspectAgent).toHaveBeenCalledWith('custom/agent.py:root_agent');
      expect(screen.getByText('custom_tool_a')).toBeDefined();
    });
  });
});
