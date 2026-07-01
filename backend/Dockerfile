FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# libgomp1 is required at runtime by numba (pulled in by smartmoneyconcepts).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# No --only-binary here: on Linux/py3.12 the heavy deps (numpy/pandas/numba)
# ship manylinux wheels, while pure-Python ones like `ta` are sdist-only and
# must be allowed to install from source (no compiler needed for them).
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# App Platform injects $PORT (defaults to 8080 locally).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
