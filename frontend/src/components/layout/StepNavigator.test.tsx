import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepNavigator } from './StepNavigator';

describe('StepNavigator Component', () => {
  it('renders all 7 step pills in sequence', () => {
    const onStepClick = vi.fn();
    render(
      <StepNavigator
        currentStep={1}
        maxStepReached={1}
        onStepClick={onStepClick}
      />
    );

    const stepLabels = [
      '1. Target Agent',
      '2. Ingest Spec',
      '3. Elicitation',
      '4. Dataset Grid',
      '5. Task View',
      '6. Live Run',
      '7. Scorecard',
    ];

    for (const label of stepLabels) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('disables steps beyond maxStepReached and enables reached steps', () => {
    const onStepClick = vi.fn();
    render(
      <StepNavigator
        currentStep={2}
        maxStepReached={3}
        onStepClick={onStepClick}
      />
    );

    const step1Btn = screen.getByRole('button', { name: /1\. Target Agent/i });
    const step3Btn = screen.getByRole('button', { name: /3\. Elicitation/i });
    const step4Btn = screen.getByRole('button', { name: /4\. Dataset Grid/i });

    expect(step1Btn.hasAttribute('disabled')).toBe(false);
    expect(step3Btn.hasAttribute('disabled')).toBe(false);
    expect(step4Btn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(step1Btn);
    expect(onStepClick).toHaveBeenCalledWith(1);

    fireEvent.click(step4Btn);
    // Should not call onStepClick since step 4 is disabled
    expect(onStepClick).not.toHaveBeenCalledWith(4);
  });
});
