# syntax=docker/dockerfile:1
FROM node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY data/sources/pubchem-periodic-table.json /build/data/sources/pubchem-periodic-table.json
RUN npm run build

FROM python:3.14.7-slim-bookworm@sha256:82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56 AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    QAL_MODE=public \
    QAL_HOST=0.0.0.0 \
    QAL_COMPUTE_TIMEOUT=8 \
    QAL_WORKER_MEMORY_MIB=192 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1
WORKDIR /app
COPY requirements.txt requirements-production.txt constraints-production.txt ./
RUN python -m pip install --no-cache-dir -r requirements-production.txt \
    && python -m pip check \
    && groupadd --gid 10001 quantum \
    && useradd --uid 10001 --gid quantum --no-create-home --shell /usr/sbin/nologin quantum
COPY --chown=10001:10001 backend/ ./backend/
COPY --chown=10001:10001 quantum_engine/ ./quantum_engine/
COPY --chown=10001:10001 quantum_atom_lab/ ./quantum_atom_lab/
COPY --chown=10001:10001 research_engine/ ./research_engine/
COPY --chown=10001:10001 run.py ./
COPY --from=frontend --chown=10001:10001 /build/frontend/dist ./frontend/dist
USER 10001:10001
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8765')+'/api/health',timeout=3)"
CMD ["python", "run.py"]
