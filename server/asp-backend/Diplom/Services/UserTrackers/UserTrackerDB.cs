using Diplom.Hubs;
using Diplom.Models.Hub;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Diplom.Models.UserTrackers;
using System.Text.Json;
using Diplom.Models.DTO;
using Diplom.Mappers;
using Diplom.DBContexts;
using Diplom.Models.DB.Main;

namespace Diplom.Services.UserTrackers
{
    public class UserTrackerDB : IUserTracker
    {
        IHubContext<SchemeHub> hubContext;
        private readonly ILogger<UserTrackerDB> logger;
        private readonly IServiceScopeFactory scopeFactory;

        public UserTrackerDB(
            IHubContext<SchemeHub> _hubContext,
            ILogger<UserTrackerDB> _logger,
            IServiceScopeFactory _scopeFactory)
        {
            hubContext = _hubContext;
            logger = _logger;
            scopeFactory = _scopeFactory;
        }
        public async Task AddClient(int schemeId, string connectionId)
        {
            using (var scope = scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationContext>();

                SchemeUpdate schemeUpdate = new SchemeUpdate
                {
                    SchemeID = schemeId,
                    ConnectionID = connectionId
                };

                //context.SchemeUpdates.Add(schemeUpdate);
                await context.SaveChangesAsync();

                logger.LogInformation($"[] Клиент (ConnectionID- {connectionId}) записан в БД (схема- {schemeId}): ID записи- {schemeUpdate.ID}.");
            }
        }

        public async Task DeleteClient(int schemeId, string connectionId)
        {
            using (var scope = scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationContext>();

                /*
                await context.SchemeUpdates
                    .Where(su => su.SchemeID == schemeId && su.ConnectionID == connectionId)
                    .ExecuteDeleteAsync();
                */

                logger.LogInformation($"[] Клиент удален из БД (схема- {schemeId}): ID пользователя- {connectionId}.");
            }
        }

        public async Task DeleteClientEverywhere(string connectionId)
        {
            using (var scope = scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationContext>();

                /*
                await context.SchemeUpdates
                    .Where(su => su.ConnectionID == connectionId)
                    .ExecuteDeleteAsync();
                */
                logger.LogInformation($"[] Клиент удален из всех схем: ID пользователя- {connectionId}.");
            }
        }

        public async Task<HubCodeRequest> GetUpdates(int schemeId)
        {
            DateTime sendingDateTime = DateTime.UtcNow;
            //отправляем всем в группе
            await hubContext.Clients
                .Group($"scheme-{schemeId}")
                .SendAsync("RequestUpdates", schemeId);

            using (var scope = scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationContext>();
                /*
                var schemeUpdates = await context.SchemeUpdates
                    .Where(su => su.SchemeID == schemeId)
                    .ToListAsync();

                if (schemeUpdates == null || schemeUpdates.Count == 0)
                    return new HubCodeRequest();
                
                var ids = schemeUpdates.Select(su => su.ConnectionID).ToList();
                string idsStr = "";
                
                foreach (var id in ids)
                {
                    idsStr += id + "\n";
                }
                
                logger
                    .LogInformation($"[] Список пользователей подключения ({schemeUpdates.Count} пользователей): {idsStr}.");

                //проставляем время отправки запроса
                foreach (var update in schemeUpdates)
                {
                    update.SendDateTime = sendingDateTime;
                    update.IsSent = false;
                }
                await context.SaveChangesAsync();

                logger.LogInformation($"[] Ожидание получения обновлений началось.");

                while (true)
                {
                    var pendingCount = await context.SchemeUpdates
                        .CountAsync(su => su.SchemeID == schemeId && !su.IsSent);

                    if (pendingCount == 0)
                        break;

                    logger.LogInformation($"[] Ожидание: {pendingCount} клиентов еще не ответили.");
                    //задержка в секунду
                    await Task.Delay(1000);
                }
                */
                /*получаем актуальные данные
                List<SchemeUpdate> actualSchemeUpdates = await context.SchemeUpdates
                    .Where(su => su.SchemeID ==schemeId)
                    .ToListAsync();

                while (!actualSchemeUpdates.All(u => u.IsSent))
                {
                    logger.LogInformation($"[] Всего клиентов схемы- {actualSchemeUpdates.Count}, галочек- {actualSchemeUpdates.Where(su => su.IsSent).ToList().Count}.");
                    //задержка в секунду
                    await Task.Delay(1000);

                    //получаем актуальные данные
                    actualSchemeUpdates = await context.SchemeUpdates
                        .Where(su => su.SchemeID == schemeId)
                        .ToListAsync();
                }
                */

                /*
                List<SchemeUpdate> actualSchemeUpdates = await context.SchemeUpdates
                    .AsNoTracking()
                    .Where(su => su.SchemeID == schemeId)
                    .ToListAsync();

                string results = "";

                foreach (var update in actualSchemeUpdates)
                {
                    results += $"\nКлиент: {update.ConnectionID}, изменения: {update.Updates}";
                }

                logger.LogInformation($"[] Обновления успешно получены (до сброса галочек): {results}");

                //убираем галочки обратно
                await context.SchemeUpdates
                    .Where(su => su.SchemeID == schemeId)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(su => su.IsSent, false));
                */
                /*
                foreach (var schemeUpdate in actualSchemeUpdates)
                {
                    schemeUpdate.IsSent = false;
                }
                await context.SaveChangesAsync();
                */

                /*
                List<SchemeUpdate> finalUpdates = await context.SchemeUpdates
                    .Where(su => su.SchemeID == schemeId)
                    .ToListAsync();

                string results = "";

                foreach (var update in finalUpdates)
                {
                    results += $"\nКлиент: {update.ConnectionID}, изменения: {update.Updates}";
                }

                logger.LogInformation($"[] Обновления успешно получены: {results}");
                */

                //объединяем полученные изменнеия
                List<SchemeUpdate> actualSchemeUpdates = new List<SchemeUpdate> ();
                return GetAllUpdates(actualSchemeUpdates);
            }
        }

        private HubCodeRequest GetAllUpdates(List<SchemeUpdate> schemeUpdates)
        {

            if (!schemeUpdates.Any())
                return new HubCodeRequest();

            List<SchemeUpdateDTO> schemeUpdatesDTO = schemeUpdates
                .Select(su => SchemeUpdateToDTOMapper.Map(su))
                .ToList();

            List<HubCodeRequest> nonNullUpdates = schemeUpdatesDTO
                .Select(sud => sud.Updates)
                .Where(u => u != null)
                .ToList();

            var hubStyles = nonNullUpdates
                .Select(u => u.HubStyles)
                .Where(hs => hs != null)
                .ToList();

            return new HubCodeRequest
            {
                Blocks = nonNullUpdates
                    .Where(u => u.Blocks != null)
                    .SelectMany(u => u.Blocks)
                    .ToList(),
                DataFlows = nonNullUpdates
                    .Where(u => u.DataFlows != null)
                    .SelectMany(u => u.DataFlows)
                    .ToList(),
                Connections = nonNullUpdates
                    .Where(u => u.Connections != null)
                    .SelectMany(u => u.Connections)
                    .ToList(),
                HubStyles = new HubStyles
                {
                    Blocks = hubStyles
                        .Where(hs => hs.Blocks != null)
                        .SelectMany(hs => hs.Blocks)
                        .ToList(),
                    Connections = hubStyles
                    .Where(hs => hs.Connections != null)
                    .SelectMany(hs => hs.Connections)
                    .ToList()
                }
            };
        }

        public async Task SetUpdatesSending(int schemeId, string connetcionId)
        {
            using (var scope = scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationContext>();

                /*
                SchemeUpdate schemeUpdate = await context.SchemeUpdates
                    .Where(su => su.SchemeID == schemeId && su.ConnectionID == connetcionId)
                    .FirstOrDefaultAsync();
                
                if (schemeUpdate == null)
                    return;

                schemeUpdate.IsSent = true;
                */
                await context.SaveChangesAsync();

                logger.LogInformation($"[] Клиенту ({connetcionId}) проставлена галочка для схемы {schemeId}.");
            }
        }

        public async Task SetUserUpdates(int schemeId, string connectionId, HubCodeRequest codeRequest)
        {
            using (var scope = scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<ApplicationContext>();

                /*
                SchemeUpdate schemeUpdate = await context.SchemeUpdates
                    .Where(su => su.SchemeID == schemeId && su.ConnectionID == connectionId)
                    .FirstOrDefaultAsync();
                
                if (schemeUpdate == null)
                    return;

                string updatesStr = JsonSerializer.Serialize(codeRequest);

                schemeUpdate.Updates = updatesStr;
                // ставим галочку
                schemeUpdate.IsSent = true;
                */
                await context.SaveChangesAsync();

                //logger.LogInformation($"[] Изменения Клиента ({connectionId}) сохранены для схемы {schemeId}, изменения: {updatesStr}.");
            }
        }
    }
}
