# en+flow

## Figma 

[Дизайн проекта](https://www.figma.com/design/cmB3bJgVKbfQPrTNwucrsg/En-Flow?node-id=0-1&p=f&t=HNAuzwRlZKBX5FVt-0)

## Docker

Docker Compose теперь лежит в корне проекта: `./docker-compose.yml`.

Docker-файлы вынесены в:
- `./docker/asp-backend`
- `./docker/fastapi-backend`

Запуск из корня проекта:

```sh
docker compose up -d --build
```

Сервисы:
- ASP.NET Backend: `http://localhost:5000/swagger`
- FastAPI Backend: `http://localhost:8000/docs`
- MS SQL Server: `localhost:1433`
- PostgreSQL: `localhost:5432`

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
