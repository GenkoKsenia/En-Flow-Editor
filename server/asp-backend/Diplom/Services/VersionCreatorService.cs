using Diplom.Hubs;
using Diplom.Mappers;
using Diplom.Models.DB;
using Diplom.Models.DTO;
using Diplom.Models.Hub;
using Diplom.Services.UserTrackers;
using KellermanSoftware.CompareNetObjects;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace Diplom.Services
{
    public class VersionCreatorService: BackgroundService
    {
        private readonly ILogger<VersionCreatorService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<SchemeHub> _hubContext;
        private Timer _timer;
        // TODO ЗАМЕНИТЬ!!!!!
        private readonly TimeSpan _period = TimeSpan.FromSeconds(20);
        private IUserTracker _userTracker;

        private Dictionary<int, HashSet<string>> connectedIds = new Dictionary<int, HashSet<string>>();

        public VersionCreatorService(
            ILogger<VersionCreatorService> logger, 
            IServiceScopeFactory scopeFactory, 
            IHubContext<SchemeHub> hubContext, 
            IUserTracker userTracker)
        {
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
            _logger = logger;
            _userTracker = userTracker;
        }

        protected override async Task ExecuteAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("[] Сервис по созданию новых версий схем запущен.");

            _timer = new Timer(async _ => await DoWork(), null, TimeSpan.Zero, _period);

            // Ждем отмены
            try
            {
                await Task.Delay(Timeout.Infinite, cancellationToken);
            }
            catch (TaskCanceledException)
            {
                _logger.LogInformation("[] Сервис по созданию новых версий схем останавливается...");
            }
            finally
            {
                _timer?.Dispose();
            }

            _logger.LogInformation("[] Сервис по созданию новых версий схем остановлен.");
        }

        private async Task DoWork()
        {
            try
            {
                _logger.LogInformation("[] Сервис по созданию новых версий схем работает.");

                using (var scope = _scopeFactory.CreateScope())
                {
                    var dbScope = scope.ServiceProvider.GetRequiredService<ApplicationContext>();

                    await CreateNewSchemeVersion(dbScope);
                }
            }
            catch (Exception ex)
            {
                _logger.LogInformation(ex, "[] Ошибка при работе сервиса.");
            }
        }

        public override void Dispose()
        {
            _timer.Dispose();
            base.Dispose();
        }

        private async Task CreateNewSchemeVersion(ApplicationContext context)
        {
            List<Scheme> allSchemes = await context.Schemes
                .Include(s => s.Versions)
                .ToListAsync();

            foreach (Scheme scheme in allSchemes)
            {
                if (scheme.Versions.Count < 2)
                {
                    await CreateVersionWithoutComparing(scheme, context);
                }
                else
                {
                    await CreateVersionWithComparing(scheme, context);
                }
            }
        }

        private async Task CreateVersionWithoutComparing(Scheme scheme, ApplicationContext context)
        {
            //блокируем схему
            scheme.IsReadOnly = true;
            await context.SaveChangesAsync();

            _logger.LogInformation($"[] У схемы ({scheme.ID}) 1 версия, схема заблокирована, начат процесс создания версии.");

            //берем код посленей версии
            var allVersions = scheme.Versions.OrderByDescending(v => v.Date);
            var latestVersion = allVersions.First();
            var latestVersionDto = VersionToDtoMapper.Map(latestVersion);

            //собираем изменнеия
            //var allUpdates = await GetUpdates(scheme);
            var allUpdates = await _userTracker.GetUpdates(scheme.ID);

            //применяем изменения и записываем в сущность БД
            CodeUpdater.Update(latestVersionDto.Code, allUpdates);
            string updatedCode = JsonSerializer.Serialize(latestVersionDto.Code);
            latestVersion.Code = updatedCode;

            var newVersion = new Models.DB.Version
            {
                Code = latestVersion.Code,
                SchemeID = scheme.ID
            };
            context.Versions.Add(newVersion);

            //сохраняем
            await context.SaveChangesAsync();

            _logger.LogInformation($"[] Версия создана (схема- {scheme.ID}, версия- {newVersion.Id}).");


            //отправляем новую версию
            await SendNewVersion(scheme.ID, newVersion);

            //разблокировка схемы
            scheme.IsReadOnly = false; 
            await context.SaveChangesAsync();

            _logger.LogInformation("[] Версия разблокирована (схема- {scheme.ID}, версия- {newVersion.Id}).");
        }

        private async Task CreateVersionWithComparing(Scheme scheme, ApplicationContext context)
        {
            //получаем 2 последние версии
            var allVersions = scheme.Versions.OrderByDescending(v => v.Date);
            var latestVersion = allVersions.First();
            var secondToLatestVersion = allVersions.Skip(1).First();

            //сравниваем версии, если они не одинаковы, то создаем новую версию
            CompareLogic compareLogic = new CompareLogic();
            compareLogic.Config.MaxDifferences = 100;
            compareLogic.Config.IgnoreCollectionOrder = true;
            compareLogic.Config.TreatStringEmptyAndNullTheSame = false;

            ComparisonResult result = compareLogic.Compare(
                latestVersion.Code,
                secondToLatestVersion.Code);

            if (!result.AreEqual)
            {

                _logger.LogInformation($"[] У схемы ({scheme.ID}) несколько версий, последние 2 неодинаковы, начат процесс создания версии.");

                //блокируем схему
                scheme.IsReadOnly = true;
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Схема ({scheme.ID}) заблокирована.");

                var latestVersionDto = VersionToDtoMapper.Map(latestVersion);

                //собираем изменнеия
                //var allUpdates = await GetUpdates(scheme);
                var allUpdates = await _userTracker.GetUpdates(scheme.ID);

                //применяем изменения и записываем в сущность БД
                CodeUpdater.Update(latestVersionDto.Code, allUpdates);
                string updatedCode = JsonSerializer.Serialize(latestVersionDto.Code);
                latestVersion.Code = updatedCode;

                var newVersion = new Diplom.Models.DB.Version
                {
                    Code = latestVersion.Code,
                    SchemeID = latestVersion.SchemeID,
                    Comments = latestVersion.Comments
                };

                context.Versions.Add(newVersion);
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Создана новая версия схемы (схема- {scheme.ID}, версия- {newVersion.Id}).");

                //отправляем новую версию
                await SendNewVersion(scheme.ID, newVersion);

                //разблокировка схемы
                scheme.IsReadOnly = false;
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Схема ({scheme.ID}) разблокирована.");
            }
        }

        private async Task SendNewVersion(int schemeId, Models.DB.Version version)
        {
            await _hubContext.Clients.Group($"scheme-{schemeId}")
                .SendAsync("NewVersionCreated", new
                {
                    SchemeId = schemeId,
                    Version = VersionToDtoMapper.Map(version)
                });
        }
    }
}
