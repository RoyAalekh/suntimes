FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --upgrade pip && pip install uv

COPY . .

RUN uv pip install --system -r requirements.txt

EXPOSE 5000

CMD ["gunicorn", "app.app:app", "--bind", "0.0.0.0:5000"]
