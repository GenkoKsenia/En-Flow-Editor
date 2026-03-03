# Этап сборки
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source

# Копируем файл проекта и восстанавливаем зависимости
COPY *.csproj .
RUN dotnet restore

# Копируем все остальные файлы
COPY . .

# Публикуем приложение
RUN dotnet publish -c Release -o /app

# Финальный образ
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app ./

# Настройка порта и культуры (учтён ваш параметр InvariantGlobalization=false)
ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# Эти пакеты могут понадобиться для глобализации и SQL Server
RUN apt-get update && apt-get install -y \
    libicu-dev \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8080

# ВАЖНО: замените, если ваш проект называется иначе
ENTRYPOINT ["dotnet", "Diplom.dll"]