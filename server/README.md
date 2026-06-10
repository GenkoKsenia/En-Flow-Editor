# Проект "Диплом"

## Быстрый старт

### Запуск проекта

1. **Клонировать репозиторий**
   ```bash
   git clone <url-репозитория>
   cd my-project
   ```

2. **Запустить все контейнеры**
   ```bash
   docker-compose up -d --build
   ```

3. **Проверить, что всё работает**
   ```bash
   docker-compose ps
   ```

4. **Посмотреть логи**
   ```bash
   docker-compose logs -f
   ```

### Доступ к сервисам

| Сервис | URL | Логин/Пароль |
|--------|-----|--------------|
| ASP.NET Backend | http://localhost:5000 | - |
| FastAPI Backend | http://localhost:8000 | - |
| FastAPI Docs | http://localhost:8000/docs | - |
| MS SQL Server | localhost:1433 | sa / YourStrong!Passw0rd |
| PostgreSQL | localhost:5432 | postgres / 1 |

### Базы данных инициализируются автоматически

- **PostgreSQL**: таблицы и тестовые данные создаются из папки `postgres-init/`
- **MS SQL Server**: база данных создается из скрипта `mssql-init/init.sql`

### Полезные команды

```bash
# Остановить все контейнеры
docker-compose down

# Остановить и удалить volumes (базы данных)
docker-compose down -v

# Пересобрать конкретный сервис
docker-compose up -d --build aspnet-backend

# Зайти в контейнер с PostgreSQL
docker exec -it postgres-db psql -U fastapi_user -d fastapi_db

# Зайти в контейнер с MS SQL
docker exec -it mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P YourStrong!Passw0rd -C
```