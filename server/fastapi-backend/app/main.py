from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import asyncio
from datetime import datetime
from datetime import timedelta
from typing import List
import aioodbc
import asyncpg
import os

app = FastAPI()

# uvicorn main:app --reload --host 127.0.0.1 --port 8000

origins = [
    "http://127.0.0.1:5500",  # Разрешить origin вашего клиентского приложения
    "http://localhost:5500", # Ещё один распространенный вариант для разработки
    # "https://your-production-domain.com",  # Разрешить ваш production domain (если есть)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Разрешить все методы (GET, POST, PUT, DELETE, и т.д.)
    allow_headers=["*"],  # Разрешить все заголовки
)

@app.get("/users")
async def read_users():
    result = await get_users()  # Просто await вместо asyncio.run()
    return result

@app.get("/groups")
async def read_groups():
    result = await get_groups()  # Просто await вместо asyncio.run()
    return result

#****************************************************

# Параметры подключения (лучше хранить в .env)
HOST = os.getenv("DB_HOST", "localhost")
PORT = os.getenv("DB_PORT", "5432")
DATABASE = os.getenv("DB_NAME", "EN_domain")
USERNAME = os.getenv("DB_USER", "postgres")
PASSWORD = os.getenv("DB_PASSWORD", "1")

async def connect_to_database():
    try:
        conn = await asyncpg.connect(
            host=HOST,
            port=PORT,
            database=DATABASE,
            user=USERNAME,
            password=PASSWORD
        )
        print("Успешное подключение к PostgreSQL")
        return conn
    except Exception as e:
        print(f"Ошибка подключения к базе данных: {e}")
        return None

async def get_users():
    conn = await connect_to_database()
    if conn:
        # Выполнение запроса
        rows = await conn.fetch("""
            SELECT * FROM domain_user 
        """)
        
        # Создаем НОВЫЙ список для результатов
        result = [dict(row) for row in rows]
        
        # Закрываем соединение (важно!)
        await conn.close()
        
        return result
    return []

async def get_groups():
    conn = await connect_to_database()
    if conn:
        # Выполнение запроса
        rows = await conn.fetch("""
            SELECT * FROM domain_group 
        """)
        
        # Создаем НОВЫЙ список для результатов
        result = [dict(row) for row in rows]
        
        # Закрываем соединение (важно!)
        await conn.close()
        
        return result
    return []

async def mainer():
    conn = await connect_to_database()
    if conn:
        # Выполнение запроса
        rows = await conn.fetch("""
            SELECT * FROM domain_user 
            JOIN user_groups ON domain_user.sid = user_groups.user_id 
            JOIN domain_group ON user_groups.group_id = domain_group.sid
        """)
        
        # Создаем НОВЫЙ список для результатов
        result = [dict(row) for row in rows]
        
        # Закрываем соединение (важно!)
        await conn.close()
        
        return result
    return []
