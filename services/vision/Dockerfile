FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY services/vision/pyproject.toml services/vision/uv.lock /app/
COPY services/vision/src /app/src
COPY services/vision/model_registry.json /app/model_registry.json
COPY contracts/backend/v1 /app/contracts/backend/v1

RUN pip install --no-cache-dir uv==0.13.1 \
    && uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONPATH="/app/src"

USER 10001
EXPOSE 8080

CMD ["uvicorn", "ecoloop_vision.main:app", "--host", "0.0.0.0", "--port", "8080"]
