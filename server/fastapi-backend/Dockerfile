FROM python:3.11-slim

WORKDIR /code

# Сначала копируем только зависимости (для кэширования)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY ./app /code/app

# Запускаем приложение
CMD ["fastapi", "run", "app/main.py", "--port", "8000", "--host", "0.0.0.0"]
# Или альтернативный вариант с uvicorn:
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]