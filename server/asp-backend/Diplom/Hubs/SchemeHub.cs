using Diplom.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Diplom.Models.Requests;
using Diplom.Mappers;
using Azure.Core;
using System.Text.Json;
using System.Security.Cryptography;
using Diplom.Models.Hub;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.Security.Principal;
using Diplom.Models.DTO;
using Microsoft.Extensions.Logging;
using Diplom.Services.UserTrackers;
using Microsoft.EntityFrameworkCore.Metadata;
using Diplom.DBContexts;
using Diplom.Models.DB.Main;

namespace Diplom.Hubs
{
    [Authorize]
    public class SchemeHub: Hub
    {
        private ApplicationContext context;
        private readonly ILogger<SchemeHub> logger;
        private IUserTracker userTracker;

        private static readonly ConcurrentDictionary<string, LockedElementInfo> lockedElements = new();

        public SchemeHub(
            ApplicationContext _context, 
            ILogger<SchemeHub> _logger, 
            IUserTracker _userTracker)
        {
            context = _context;
            logger = _logger;
            userTracker = _userTracker;
        }

        private string GetCurrentUserSid()
        {
            var windowsIdentity = Context.User.Identity as WindowsIdentity;
            return windowsIdentity?.User?.Value;
        }

        private List<string> GetCurrentUserGroups()
        {
            var windowsIdentity = Context.User.Identity as WindowsIdentity;
            return windowsIdentity?.Groups?
                .Cast<IdentityReference>()
                .Select(g => g.Value)
                .ToList() ?? new List<string>();
        }

        public override async Task OnConnectedAsync()
        {
            logger.LogInformation("Клиент подключился к схеме. ConnectionId: {ConnectionId}",
                Context.ConnectionId);

            await base.OnConnectedAsync();
        }

        // OnDisconnectedAsync для очистки
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            logger.LogInformation("Клиент отключился от схем. ConnectionId: {ConnectionId}",
                Context.ConnectionId);
            //удалить клиента из статичной переменной
            //и удалить записи о заблокированных элементах

            await userTracker.DeleteClientEverywhere(Context.ConnectionId);

            var keysToRemove = lockedElements
                .Where(k => k.Value.ConnectionId == Context.ConnectionId)
                .Select(k => k.Key)
                .ToList();

            foreach (var key in keysToRemove)
            {
                lockedElements.TryRemove(key, out _);
            }

            // SignalR сам удалит из всех групп
            await base.OnDisconnectedAsync(exception);
        }

        public async Task<SchemeResponseDto> JoinScheme(int schemeId)
        {
            String Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.FavoriteSchemes.Where(f => f.UserID == Sid))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync();

            if (availableScheme == null)
                throw new HubException("Access denied");

            await Groups.AddToGroupAsync(Context.ConnectionId, $"scheme-{schemeId}");

            //добавляем клиента в слежку
            await userTracker.AddClient(schemeId, Context.ConnectionId);

            logger.LogInformation($"Клиент подключился к конкретной схеме- {schemeId}. ConnectionId: {Context.ConnectionId}");
            
            return SchemeToDtoMapper.Map(availableScheme, availableScheme.FavoriteSchemes.Any());
        }

        public async Task LeaveScheme(int schemeId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"scheme-{schemeId}");

            await userTracker.DeleteClient(schemeId, Context.ConnectionId);

            logger.LogInformation($"Клиент отключился от конкретной схемы- {schemeId}. ConnectionId: {Context.ConnectionId}");
        }

        public async Task SendChanges(int schemeId, HubCodeRequest codeRequest)
        {
            String Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            int editingRightLevel = 2;
            
            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync();
            

            if (availableScheme == null)
                return;

            var latestVersion = availableScheme.Versions.FirstOrDefault();

            if (latestVersion.IsReadOnly)
                return;

            if (availableScheme.Versions != null && availableScheme.Versions.Any())
            {
                var latestVersionDto = VersionToDtoMapper.Map(latestVersion);

                //применение изменений
                CodeRequest latestCode = latestVersionDto.Code;
                CodeUpdater.Update(latestCode, codeRequest);

                //запись в сущность БД
                string updatedCode = JsonSerializer.Serialize(latestCode);
                latestVersion.Code = updatedCode;

                await context.SaveChangesAsync();

                //рассылка остальным пользователям
                await Clients.OthersInGroup($"scheme-{schemeId}")
                    .SendAsync("CodeUpdated", new
                    {
                        SchemeId = schemeId,
                        VersionId = latestVersion.Id, 
                        Changes = codeRequest,
                        UserSid = Sid, 
                        Timestamp = DateTime.UtcNow
                    });

                //отправка подтверждения отправителю
                await Clients.Caller.SendAsync("ChangesSaved", new
                {
                    SchemeId = schemeId,
                    VersionId = latestVersion.Id,
                    Timestamp = DateTime.UtcNow
                });

                logger.LogInformation($"Клиент отправил изменения к схеме- {schemeId}. ConnectionId: {Context.ConnectionId}, изменения: {JsonSerializer.Serialize(codeRequest)}");
            }
        }

        public async Task LockElement(int schemeId, string elementType, string elementId)
        {
            String Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            int editingRightLevel = 2;

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync();


            if (availableScheme == null)
                return;

            string lockKey = $"scheme-{schemeId}-{elementType}-{elementId}";

            if (lockedElements.TryGetValue(lockKey, out var existingLock))
            {
                // TODO заменить ConnectionID на SID???
                if (existingLock.ConnectionId != Context.ConnectionId)
                {
                    await Clients.Caller.SendAsync("ElementLocked", new
                    {
                        SchemeId = schemeId,
                        ElementType = elementType,
                        ElementId = elementId
                    });

                    logger.LogInformation($"Клиент ({Context.ConnectionId}) попытася заблокировать элемент (scheme-{schemeId}-{elementType}-{elementId}), но он уже заблокирован пользователем с ConnectionId- {existingLock.ConnectionId}.");
                    return;
                }
            }

            var lockInfo = new LockedElementInfo
            {
                UserSid = Sid,
                ConnectionId = Context.ConnectionId,
                LockTime = DateTime.UtcNow,
                ElementType = elementType,
                ElementId = elementId
            };

            lockedElements[lockKey] = lockInfo;

            //уведомляем остальных
            await Clients.OthersInGroup($"scheme-{schemeId}")
                .SendAsync("ElementLockedByUser", new
                {
                    ElementType = elementType,
                    ElementId = elementId,
                    LockedBy = Sid,
                    LockTime = DateTime.UtcNow
                });

            //подтверждение пользователю
            await Clients.Caller.SendAsync("ElementLockAcquired", new
            {
                ElementType = elementType,
                ElementId = elementId,
                LockTime = DateTime.UtcNow
            });

            logger.LogInformation($"Клиент ({Context.ConnectionId}) заблокировал элемент (scheme-{schemeId}-{elementType}-{elementId}).");
        }

        public async Task UnlockElement(int schemeId, string elementType, string elementId)
        {
            String Sid = GetCurrentUserSid();

            string lockKey = $"scheme-{schemeId}-{elementType}-{elementId}";

            if (lockedElements.TryGetValue(lockKey, out var existingLock))
            {
                // TODO заменить ConnectionID на SID???
                if (existingLock.ConnectionId == Context.ConnectionId)
                {
                    // Удаляем блокировку
                    lockedElements.TryRemove(lockKey, out _);

                    // Уведомляем всех
                    await Clients.OthersInGroup($"scheme-{schemeId}")
                        .SendAsync("ElementUnlocked", new
                        {
                            SchemeId = schemeId, 
                            ElementType = elementType,
                            ElementId = elementId
                        });

                    logger.LogInformation($"Клиент ({Context.ConnectionId}) разблокировал элемент (scheme-{schemeId}-{elementType}-{elementId}).");
                }
                else
                {
                    await Clients.Caller.SendAsync("CannotUnlock");
                    logger.LogInformation($"Клиент ({Context.ConnectionId}) попытася разблокировать элемент (scheme-{schemeId}-{elementType}-{elementId}), но он заблокирован пользователем с ConnectionId- {existingLock.ConnectionId}.");
                }
            }
        }

        public async Task SubmitSchemeUpdates(int schemeId, HubCodeRequest codeRequest)
        {
            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            int editingRightLevel = 2;

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync();


            if (availableScheme == null)
            {
                await userTracker.SetUpdatesSending(schemeId, Context.ConnectionId);
                return;
            }

            await userTracker.SetUserUpdates(schemeId, Context.ConnectionId, codeRequest);

            logger.LogInformation($"Несохраненные изменения клиента ({Context.ConnectionId}) приняты! Изменения: {JsonSerializer.Serialize(codeRequest)}");

            await Clients.Caller.SendAsync("UpdatesSubmitted", schemeId);
        }
    }
}
