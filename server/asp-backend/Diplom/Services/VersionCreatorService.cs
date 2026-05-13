using Diplom.DBContexts;
using Diplom.Hubs;
using Diplom.Mappers;
using Diplom.Models.DB.Main;
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
        private readonly TimeSpan _period = TimeSpan.FromMinutes(2);
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

            _timer = new Timer(async _ => await DoWork(), null, TimeSpan.FromSeconds(20), _period);

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
                    _logger.LogInformation("[] DoWork: Scope создан");

                    var dbScope = scope.ServiceProvider.GetRequiredService<ApplicationContext>();
                    _logger.LogInformation("[] DoWork: DbContext получен");

                    _logger.LogInformation("[] DoWork: Вызов CreateNewSchemeVersion...");
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
            _logger.LogInformation("[] CreateNewSchemeVersion: собираем схемы");
            List<Scheme> allSchemes = await context.Schemes
                .Include(s => s.Versions
                    .OrderByDescending(v => v.Date)
                    .Take(5))
                .ToListAsync();

            _logger.LogInformation("[] CreateNewSchemeVersion: схемы получены");

            foreach (Scheme scheme in allSchemes)
            {
                _logger.LogInformation($"[] CreateNewSchemeVersion: работаем со схемой {scheme.ID}, ее количество версий: {scheme.Versions?.Count ?? 0}.");

                // ВРЕМЕННО: добавим проверку
                if (scheme.Versions == null)
                {
                    _logger.LogWarning($"[] ВНИМАНИЕ! У схемы {scheme.ID} Versions = null!");
                    continue;
                }

                if (scheme.Versions.Count == 0)
                {
                    _logger.LogWarning($"[] ВНИМАНИЕ! У схемы {scheme.ID} нет версий в загруженной коллекции!");
                    continue;
                }

                // ВРЕМЕННО: добавим логирование перед вызовом
                _logger.LogInformation($"[] Для схемы {scheme.ID} будет вызван метод {(scheme.Versions.Count < 2 ? "CreateVersionWithoutComparing" : "CreateVersionWithComparing")}");

                if (scheme.Versions.Count < 2)
                {
                    await CreateVersionWithoutComparing(scheme, context);
                }
                else
                {
                    await CreateVersionWithComparing(scheme, context);
                }
                _logger.LogInformation($"[] Схема {scheme.ID} успешно обработана");
            }
        }

        private async Task CreateVersionWithoutComparing(Scheme scheme, ApplicationContext context)
        {
            //блокируем версию схемы
            /*
            scheme.IsReadOnly = true;
            await context.SaveChangesAsync();
            */

            Models.DB.Main.Version latestVersion = scheme.Versions.First();
            latestVersion.IsReadOnly = true;
            await context.SaveChangesAsync();

            _logger.LogInformation($"[] У схемы ({scheme.ID}) 1 версия, версия заблокирована, начат процесс создания версии.");

            /*берем код посленей версии
            var allVersions = scheme.Versions.OrderByDescending(v => v.Date);
            var latestVersion = allVersions.First();
            */
            var latestVersionDto = VersionToDtoMapper.Map(latestVersion);

            //собираем изменнеия
            //var allUpdates = await GetUpdates(scheme);
            _logger.LogInformation($"[] Начинаем сбор обновлений от пользователей вебсокета.");

            var allUpdates = await _userTracker.GetUpdates(scheme.ID);

            _logger.LogInformation($"[] Все обновления {allUpdates}.");

            bool isThereUpdates = (allUpdates.Blocks?.Any() ?? false) ||
                (allUpdates.DataFlows?.Any() ?? false) ||
                (allUpdates.Connections?.Any() ?? false) ||
                (allUpdates.HubStyles?.Blocks?.Any() ?? false) ||
                (allUpdates.HubStyles?.Connections?.Any() ?? false);

            if (allUpdates != null && isThereUpdates)
            {
                //применяем изменения и записываем в сущность БД
                CodeUpdater.Update(latestVersionDto.Code, allUpdates);
                string updatedCode = JsonSerializer.Serialize(latestVersionDto.Code);
                latestVersion.Code = updatedCode;
            }    

            var newVersion = new Models.DB.Main.Version
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

            /*разблокировка схемы
            scheme.IsReadOnly = false; 
            await context.SaveChangesAsync();
            
            _logger.LogInformation("[] Версия разблокирована (схема- {scheme.ID}, версия- {newVersion.Id}).");
            */
        }

        private async Task CreateVersionWithComparing(Scheme scheme, ApplicationContext context)
        {
            _logger.LogInformation($"[] CreateVersionWithComparing: НАЧАЛО для схемы {scheme.ID}");
            _logger.LogInformation($"[] Versions count: {scheme.Versions?.Count ?? 0}");

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

                /*блокируем схему
                scheme.IsReadOnly = true;
                await context.SaveChangesAsync();
                */

                latestVersion.IsReadOnly = true;
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Версия ({latestVersion.Id}) схемы ({scheme.ID}) заблокирована.");

                var latestVersionDto = VersionToDtoMapper.Map(latestVersion);

                //собираем изменнеия
                //var allUpdates = await GetUpdates(scheme);
                var allUpdates = await _userTracker.GetUpdates(scheme.ID);

                bool isThereUpdates = (allUpdates.Blocks?.Any() ?? false) ||
                    (allUpdates.DataFlows?.Any() ?? false) ||
                    (allUpdates.Connections?.Any() ?? false) ||
                    (allUpdates.HubStyles?.Blocks?.Any() ?? false) ||
                    (allUpdates.HubStyles?.Connections?.Any() ?? false);

                if (allUpdates != null && isThereUpdates)
                {
                    //применяем изменения и записываем в сущность БД
                    CodeUpdater.Update(latestVersionDto.Code, allUpdates);
                    string updatedCode = JsonSerializer.Serialize(latestVersionDto.Code);
                    latestVersion.Code = updatedCode;
                }

                var newVersion = new Diplom.Models.DB.Main.Version
                {
                    Code = latestVersion.Code,
                    SchemeID = latestVersion.SchemeID
                };

                context.Versions.Add(newVersion);
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Создана новая версия схемы (схема- {scheme.ID}, версия- {newVersion.Id}).");

                //отправляем новую версию
                await SendNewVersion(scheme.ID, newVersion);

                /*разблокировка схемы
                scheme.IsReadOnly = false;
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Схема ({scheme.ID}) разблокирована.");
                */
            }
            else
            {
                /* блокируем схему
                scheme.IsReadOnly = true;
                await context.SaveChangesAsync();
                */

                /*
                latestVersion.IsReadOnly = true;
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Версия ({latestVersion.Id}) схемы ({scheme.ID}) заблокирована.");
                */

                var latestVersionDto = VersionToDtoMapper.Map(latestVersion);

                //собираем изменнеия
                //var allUpdates = await GetUpdates(scheme);
                var allUpdates = await _userTracker.GetUpdates(scheme.ID);

                _logger.LogInformation($"[] Обновления получены.");

                bool isThereUpdates = (allUpdates.Blocks?.Any() ?? false) ||
                    (allUpdates.DataFlows?.Any() ?? false) ||
                    (allUpdates.Connections?.Any() ?? false) ||
                    (allUpdates.HubStyles?.Blocks?.Any() ?? false) ||
                    (allUpdates.HubStyles?.Connections?.Any() ?? false);

                if (allUpdates != null && isThereUpdates)
                {
                    _logger.LogInformation($"[] Изменения есть, начало их применения.");

                    //блокировка версии
                    latestVersion.IsReadOnly = true;
                    await context.SaveChangesAsync();

                    _logger.LogInformation($"[] Версия ({latestVersion.Id}) схемы ({scheme.ID}) заблокирована.");


                    //применяем изменения и записываем в сущность БД
                    CodeUpdater.Update(latestVersionDto.Code, allUpdates);
                    string updatedCode = JsonSerializer.Serialize(latestVersionDto.Code);
                    latestVersion.Code = updatedCode;

                    var newVersion = new Diplom.Models.DB.Main.Version
                    {
                        Code = latestVersion.Code,
                        SchemeID = latestVersion.SchemeID
                    };

                    context.Versions.Add(newVersion);
                    await context.SaveChangesAsync();

                    _logger.LogInformation($"[] Создана новая версия схемы (схема- {scheme.ID}, версия- {newVersion.Id}).");

                    //отправляем новую версию
                    await SendNewVersion(scheme.ID, newVersion);
                }

                /*разблокировка схемы
                scheme.IsReadOnly = false;
                await context.SaveChangesAsync();

                _logger.LogInformation($"[] Схема ({scheme.ID}) разблокирована.");
                */
            }
        }

        private async Task SendNewVersion(int schemeId, Models.DB.Main.Version version)
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
