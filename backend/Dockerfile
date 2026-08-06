FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

FROM base AS dev
# Test toolchain lives only in this stage — the prod stage below installs
# just the runtime dependencies.
RUN pip install --no-cache-dir -e ".[dev]"
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
COPY . .
RUN chmod +x /app/entrypoint.sh
# curl is used by the container health check; the slim image has no client.
RUN apt-get update && apt-get install -y --no-install-recommends curl     && rm -rf /var/lib/apt/lists/*
# Migrations run here, before uvicorn binds, so a deploy cannot serve
# traffic against a schema the new code does not expect.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
