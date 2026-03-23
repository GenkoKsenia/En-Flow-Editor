FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Diplom.sln ./
COPY Diplom/Diplom.csproj Diplom/
RUN dotnet restore Diplom.sln

COPY . .
RUN dotnet publish Diplom/Diplom.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Diplom.dll"]
