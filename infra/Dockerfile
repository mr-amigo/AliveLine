# Build context = repo root:  docker build -f infra/Dockerfile -t aliveline .

# ---- Stage 1: build the React frontend ----
# glibc image: Rollup's native parser fails with "Code is nested too deeply" on Alpine/musl.
FROM node:22-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: FastAPI runtime that also serves the built SPA ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /fe/dist ./static

# Non-root user; owns /app so the default SQLite file can be created in local runs.
RUN useradd --create-home --uid 1000 aliveline && chown -R aliveline /app
USER aliveline

EXPOSE 8000
# Render injects $PORT; proxy headers let FastAPI see the original https scheme.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
