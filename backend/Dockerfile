FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend.py api.py ./
COPY chroma_db ./chroma_db

# HF Spaces (Docker SDK) routes traffic to this port by default.
EXPOSE 7860

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "7860"]
