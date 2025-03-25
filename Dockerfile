# Use lightweight Python image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create working directory
WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --upgrade pip && pip install --no-cache-dir uv

# Copy the app source
COPY . .

# Expose port
EXPOSE 5000

# Run the app with uvicorn (or use gunicorn if preferred)
CMD ["uv", "pip", "install", "-r", "requirements.txt"] && uvicorn main:app --host 0.0.0.0 --port 5000
