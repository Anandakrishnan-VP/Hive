FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies
COPY backend/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code into /app/backend
COPY backend/ /app/backend/

EXPOSE 7860

# Run Gunicorn with Uvicorn workers from the root directory so absolute imports resolve correctly
CMD ["gunicorn", "-w", "1", "-k", "uvicorn.workers.UvicornWorker", "backend.api.main:app", "--bind", "0.0.0.0:7860"]
