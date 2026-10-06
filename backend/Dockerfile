# Python 3.11 slim image for fast, lightweight deployment
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    net-tools \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Create directory for persistent database
RUN mkdir -p /app/data

# Expose FastAPI REST port and Network Slice socket ports
EXPOSE 8000
EXPOSE 9101/udp
EXPOSE 9102/udp
EXPOSE 9103/udp
EXPOSE 9105/tcp
EXPOSE 9999/udp

# Run FastAPI with uvicorn listening on all network interfaces
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
