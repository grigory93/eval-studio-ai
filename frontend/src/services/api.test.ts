import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  updateCriteria,
  resolveAmbiguity,
  dismissAmbiguity,
  getSampleAgents,
  inspectAgent,
} from './api';

describe('Elicitation and Ingest API Client Services', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('updateCriteria sends PATCH request with payload', async () => {
    const mockUpdated = {
      criteria_id: 'crit-123',
      domain_rules: ['Rule A', 'Rule B'],
      edge_cases: ['Edge 1'],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockUpdated,
    } as Response);

    const result = await updateCriteria('crit-123', {
      domain_rules: ['Rule A', 'Rule B'],
      edge_cases: ['Edge 1'],
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/elicitation/criteria/crit-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain_rules: ['Rule A', 'Rule B'],
        edge_cases: ['Edge 1'],
      }),
    });
    expect(result).toEqual(mockUpdated);
  });

  it('resolveAmbiguity sends POST request to resolve endpoint', async () => {
    const mockUpdated = {
      criteria_id: 'crit-123',
      ambiguities: [{ id: 'gap-1', status: 'resolved', resolution: 'Photo required' }],
      domain_rules: ['Photo required'],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockUpdated,
    } as Response);

    const result = await resolveAmbiguity(
      'crit-123',
      'gap-1',
      'Photo required',
      true,
      'domain_rules'
    );

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/elicitation/criteria/crit-123/ambiguities/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding_id: 'gap-1',
          resolution: 'Photo required',
          create_rule: true,
          rule_type: 'domain_rules',
        }),
      }
    );
    expect(result).toEqual(mockUpdated);
  });

  it('dismissAmbiguity sends POST request to dismiss endpoint', async () => {
    const mockUpdated = {
      criteria_id: 'crit-123',
      ambiguities: [{ id: 'gap-1', status: 'dismissed' }],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockUpdated,
    } as Response);

    const result = await dismissAmbiguity('crit-123', 'gap-1');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/elicitation/criteria/crit-123/ambiguities/dismiss',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding_id: 'gap-1' }),
      }
    );
    expect(result).toEqual(mockUpdated);
  });

  it('getSampleAgents fetches sample agent presets', async () => {
    const mockAgents = [
      {
        id: 'customer-support',
        name: 'Customer Support ADK Agent',
        description: 'E-commerce agent',
        spec: 'examples/customer_support_adk/agent.py:root_agent',
        tools: ['lookup_order', 'process_refund'],
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockAgents,
    } as Response);

    const result = await getSampleAgents();
    expect(global.fetch).toHaveBeenCalledWith('/api/ingest/sample-agents');
    expect(result).toEqual(mockAgents);
  });

  it('inspectAgent posts agent spec and returns tools and status', async () => {
    const mockInspection = {
      spec: 'examples/customer_support_adk/agent.py:root_agent',
      valid: true,
      tools: ['lookup_order', 'process_refund'],
      error: undefined,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockInspection,
    } as Response);

    const result = await inspectAgent('examples/customer_support_adk/agent.py:root_agent');
    expect(global.fetch).toHaveBeenCalledWith('/api/ingest/inspect-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: 'examples/customer_support_adk/agent.py:root_agent' }),
    });
    expect(result).toEqual(mockInspection);
  });

  it('throws error when API response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(updateCriteria('nonexistent', { domain_rules: [] })).rejects.toThrow(
      'Failed to update criteria'
    );
  });
});
