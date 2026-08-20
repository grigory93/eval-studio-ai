# Eval Studio AI (`eval-studio-ai`)

**Eval Studio AI** is an interactive, visual IDE and continuous evaluation workbench for Agentic AI applications. It bridges the gap between agent specification and rigorous empirical validation.

## Key Features

- **Interactive Elicitation**: Conversational elicitation agent detects specification ambiguities and generates structured eval dimensions.
- **Dataset Synthesis**: Generates grounded evaluation datasets (positive, negative, edge cases) directly from user specifications and data contracts.
- **Task & Scorer Compilation**: Translates natural language criteria into reproducible [Inspect AI](https://inspect.ai-safety-institute.org.uk/) evaluation tasks and LLM-as-a-judge / deterministic scorers.
- **Interactive Visual Studio**: Real-time evaluation execution viewer, step-by-step trajectory trace debugger, and dynamic Mermaid workflow visualizer.
- **Actionable Diagnostics**: Automated failure analysis with failure heatmaps, root-cause diagnosis, and automated prompt/tooling recommendation engine.

## Tech Stack

- **Backend**: Python 3.13, FastAPI, Inspect AI (`inspect_ai`), Google Agent Development Kit (ADK), Pydantic v2
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Mermaid.js
- **Package & Environment Management**: `uv`

## Quickstart

### Prerequisites
- Python 3.11+ (Python 3.13 recommended)
- `uv` package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Node.js 18+ and `pnpm` (for frontend)

### Setup Virtual Environment
```bash
uv venv .venv
source .venv/bin/activate
```

## Documentation
- [SPEC.md](SPEC.md) - Comprehensive product architecture and system design specification.

## License
Apache-2.0
