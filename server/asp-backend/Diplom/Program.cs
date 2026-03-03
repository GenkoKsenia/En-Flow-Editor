using Diplom;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Diplom.Services;
using Diplom.Hubs;
using Diplom.Services.UserTrackers;

var builder = WebApplication.CreateBuilder(args);

// ��������� �����������
builder.Logging.ClearProviders();
builder.Logging.AddConsole(); // ���� � �������

// �������� ������ ����������� �� ����� ������������
string connection = builder.Configuration.GetConnectionString("DefaultConnection");

// ��������� �������� ApplicationContext � �������� ������� � ����������
builder.Services.AddDbContext<ApplicationContext>(options => options.UseSqlServer(connection));

builder.Services.AddSignalR();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUserContextService, UserContextService>();
builder.Services.AddSingleton<IUserTracker, UserTracker>();
//builder.Services.AddHostedService<VersionCreatorService>();

builder.Services.AddHttpClient();

/*
builder.Services.AddDbContext<ApplicationContext>(options =>
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
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationContext>();
    
    try
    {
        // Применяем миграции (создаст БД, если её нет)
        dbContext.Database.Migrate();
        
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("Миграции успешно применены к базе данных");
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ошибка при применении миграций");
        
        // В разработке можно пробросить исключение, чтобы контейнер перезапустился
        if (app.Environment.IsDevelopment())
        {
            throw;
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();

app.UseHttpsRedirection();

app.UseCors("VueApp");

app.UseAuthorization();
app.UseAuthorization();

app.MapControllers();

app.MapHub<SchemeHub>("/hubs/scheme");
app.MapHub<CommentsHub>("/hubs/comments");

app.Run();