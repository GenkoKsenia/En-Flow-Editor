FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ./server/asp-backend/Diplom.sln ./server/asp-backend/
COPY ./server/asp-backend/Diplom/Diplom.csproj ./server/asp-backend/Diplom/
RUN dotnet restore ./server/asp-backend/Diplom.sln

COPY ./server/asp-backend ./server/asp-backend
RUN dotnet publish ./server/asp-backend/Diplom/Diplom.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Diplom.dll"]
