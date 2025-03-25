FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install uv
RUN pip install --upgrade pip && pip install uv

# Copy files
COPY . .

# Install with uv system mode
RUN uv pip install --system -r requirements.txt

EXPOSE 5000


# Run the app
CMD ["python", "main.py"]
