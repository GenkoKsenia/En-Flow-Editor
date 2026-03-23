FROM python:3.11-slim

WORKDIR /code

COPY ./server/fastapi-backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY ./server/fastapi-backend/app ./app

CMD ["fastapi", "run", "app/main.py", "--port", "8000", "--host", "0.0.0.0"]
