using Diplom.Hubs;
using Diplom.Models.DB;
using Diplom.Models.Hub;
using Diplom.Models.UserTrackers;
using Microsoft.AspNetCore.SignalR;

namespace Diplom.Services.UserTrackers
{
    public class UserTracker : IUserTracker
    {
        IHubContext<SchemeHub> hubContext;
        private readonly ILogger<UserTracker> logger;

        public UserTracker(IHubContext<SchemeHub> _hubContext, 
            ILogger<UserTracker> _logger)
        {
            hubContext = _hubContext;
            logger = _logger;
        }

        public async Task<HubCodeRequest> GetUpdates(int schemeId)
        {
            DateTime sendingDateTime = DateTime.UtcNow;
            //отправляем всем в группе
            await hubContext.Clients
                .Group($"scheme-{schemeId}")
                .SendAsync("RequestUpdates", schemeId);

            List<TrackedUser> schemeUsers = SchemeUpdates.CurrentConnections.GetOrAdd(schemeId, new List<TrackedUser>());

            logger
                .LogInformation($"[] Список пользователей подключения ({schemeUsers.Count} пользователей): {schemeUsers.Select(su => su.ConnectionID).ToList()}.");


            foreach (var user in schemeUsers)
            {
                user.DateTime = sendingDateTime;
            }

            logger.LogInformation($"[] Ожидание получения обновлений началось.");

            while (!schemeUsers.All(u => u.IsUpdatesSended))
            {
                logger.LogInformation($"[] Всего клиентов схемы- {schemeUsers.Count}, галочек- {schemeUsers.Where(su => su.IsUpdatesSended).ToList().Count}.");
                //задержка в секунду
                await Task.Delay(1000);
            }

            //убираем галочки обратно
            foreach (var user in schemeUsers)
            {
                user.IsUpdatesSended = false;
            }

            logger.LogInformation($"[] Обновления успешно получены.");

            //собираем полученные изменнеия
            return GetAllUpdates(schemeId);
        }

        private HubCodeRequest GetAllUpdates(int schemeId)
        {
            if (SchemeUpdates.CurrentConnections
                .TryGetValue(schemeId, out List<TrackedUser> users))
            {
                List<HubCodeRequest> updates = users.Select(u => u.Updates).ToList();

                var nonNullUpdates = users
                    .Select(u => u.Updates)
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
            return new HubCodeRequest();
        }

        public Task SetUpdatesSending(int schemeId, string ConnectionId)
        {
            List<TrackedUser> schemeUsers = SchemeUpdates.CurrentConnections.GetOrAdd(schemeId, new List<TrackedUser>());

            TrackedUser user = schemeUsers.FirstOrDefault(u => u.ConnectionID == ConnectionId);

            if (user == null)
                return Task.CompletedTask;

            user.IsUpdatesSended = true;
            return Task.CompletedTask;
        }

        public Task SetUserUpdates(int schemeId, string ConnectionId, HubCodeRequest codeRequest)
        {
            List<TrackedUser> schemeUsers = SchemeUpdates.CurrentConnections.GetOrAdd(schemeId, new List<TrackedUser>());

            TrackedUser user = schemeUsers.FirstOrDefault(s => s.ConnectionID == ConnectionId);

            if (user == null) return Task.CompletedTask;

            user.Updates = codeRequest;
            // ставим галочку
            user.IsUpdatesSended = true;

            return Task.CompletedTask;
        }

        public Task AddClient(int schemeId, string ConnectionId)
        {
            List<TrackedUser> schemeUsers =  SchemeUpdates.CurrentConnections.GetOrAdd(schemeId, new List<TrackedUser>());

            schemeUsers.Add(new TrackedUser
            {
                ConnectionID = ConnectionId
            });

            return Task.CompletedTask;
        }

        public Task DeleteClient(int schemeId, string ConnectionId)
        {
            List<TrackedUser> schemeUsers = SchemeUpdates.CurrentConnections.GetOrAdd(schemeId, new List<TrackedUser>());

            schemeUsers.RemoveAll(su => su.ConnectionID == ConnectionId);

            return Task.CompletedTask;
        }

        public Task DeleteClientEverywhere(string ConnectionId)
        {
            foreach (int schemeId in SchemeUpdates.CurrentConnections.Keys)
            {
                DeleteClient(schemeId, ConnectionId);
            }

            return Task.CompletedTask;
        }
    }
}
