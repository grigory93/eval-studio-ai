# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend
FROM python:3.11-slim AS runner
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    GOOGLE_GENAI_USE_VERTEXAI=true \
    EVALSTUDIO_DATA_DIR=/app/data

# Install uv for package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project definition and backend
COPY pyproject.toml README.md ./
COPY backend/ ./backend/
COPY examples/ ./examples/

# Install backend dependencies
RUN uv pip install --system -e .

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create non-root user and data dir
RUN useradd -m -u 1000 evaluser && \
    mkdir -p /app/data && \
    chown -R evaluser:evaluser /app

USER evaluser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
