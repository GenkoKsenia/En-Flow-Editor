using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Diplom.Services;
using Diplom.Hubs;
using Diplom.Services.UserTrackers;
using Serilog;
using Serilog.Filters;
using Serilog.Events;
using Diplom.DBContexts;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}",
        restrictedToMinimumLevel: LogEventLevel.Information)
    .WriteTo.Logger(lc => lc
        .Filter.ByIncludingOnly(Matching.FromSource("Diplom.Hubs.SchemeHub"))
        .WriteTo.File("Logs/schemehub.log",
            outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"))
    .WriteTo.Logger(lc => lc
        .Filter.ByIncludingOnly(Matching.FromSource("Diplom.Services.UserTrackers.UserTrackerDB"))
        .WriteTo.File("Logs/usertrackerdb.log",
            outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}"))
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog();

// Настройка логирования
//builder.Logging.ClearProviders();
//builder.Logging.AddConsole(); // Логи в консоль

// получаем строку подключения из файла конфигурации
string connection = builder.Configuration.GetConnectionString("DefaultConnection");
string testAdConnection = builder.Configuration.GetConnectionString("TestADConnection");

// добавляем контекст ApplicationContext в качестве сервиса в приложение
builder.Services.AddDbContext<ApplicationContext>(options => options.UseSqlServer(connection));
builder.Services.AddDbContext<TestADContext>(options => options.UseSqlServer(testAdConnection));

builder.Services.AddScoped<DynamicDbContext>();

builder.Services.AddSignalR();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUserContextService, UserContextService>();
builder.Services.AddSingleton<IUserTracker, UserTrackerDB>();
builder.Services.AddHostedService<VersionCreatorService>();

builder.Services.AddHttpClient();

/*
builder.Services.AddDbContext<ApplicationContext>( options =>
{
    //options.UseSqlServer("Server=LAPTOP-6UD8366G;Database=redactor;Trusted_Connection=True;");
    options.UseSqlServer("Server=LAPTOP-6UD8366G\\SQLEXPRESS;Database=redactor;Trusted_Connection=True;TrustServerCertificate=True;");
});
*/

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = options.DefaultPolicy;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("VueApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();

app.UseHttpsRedirection();

app.UseCors("VueApp");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHub<SchemeHub>("/hubs/scheme");
app.MapHub<CommentsHub>("/hubs/comments");

app.Run();