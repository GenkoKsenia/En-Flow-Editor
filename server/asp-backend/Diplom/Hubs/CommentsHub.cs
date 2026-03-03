using Azure.Core;
using Diplom.Mappers;
using Diplom.Models.DB;
using Diplom.Models.Hub;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System;
using System.Security.Principal;

namespace Diplom.Hubs
{
    [Authorize]
    public class CommentsHub: Hub
    {
        private ApplicationContext context;
        private readonly ILogger<CommentsHub> logger;

        public CommentsHub(ApplicationContext _context, ILogger<CommentsHub> _logger)
        {
            context = _context;
            logger = _logger;
        }

        public override async Task OnConnectedAsync()
        {
            logger.LogInformation("Клиент подключился для просмотра комментов. ConnectionId: {ConnectionId}",
                Context.ConnectionId);

            await base.OnConnectedAsync();
        }

        // OnDisconnectedAsync для очистки
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            logger.LogInformation("Клиент отключился от комментов. ConnectionId: {ConnectionId}",
                Context.ConnectionId);
            // SignalR сам удалит из всех групп
            await base.OnDisconnectedAsync(exception);
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

        public async Task<IEnumerable<Comment>> JoinElementComments(int schemeId, string elementId)
        {

            String Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                    .ThenInclude(v => v.Comments)
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

            if (availableScheme.Versions == null || !availableScheme.Versions.Any())
                throw new HubException("Versions is null");

            if (elementId == null || elementId == "")
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"comments-{schemeId}");

                logger.LogInformation($"Клиент подключился к группе comments-{schemeId} и получил комменты. ConnectionId: {Context.ConnectionId}");
            }
            else
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"comments-{schemeId}-{elementId}");

                logger.LogInformation($"Клиент подключился к группе comments-{schemeId}-{elementId} и получил комменты. ConnectionId: {Context.ConnectionId}");
            }

            Models.DB.Version version = availableScheme.Versions.First();

            var comments = availableScheme.Versions.First()
                .Comments.Where(c => c.ElementID == elementId);

            return comments;
        }

        public async Task LeaveElementComments(int schemeId, string elementId)
        {
            if (elementId == null || elementId == "")
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"comments-{schemeId}");

                logger.LogInformation($"Клиент отключился от группы comments-{schemeId}. ConnectionId: {Context.ConnectionId}");
            }
            else
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"comments-{schemeId}-{elementId}");

                logger.LogInformation($"Клиент отключился от группы comments-{schemeId}-{elementId}. ConnectionId: {Context.ConnectionId}");
            }
        }

        public async Task SendComment(HubElementCommentRequest request)
        {
            logger.LogInformation($"Начало добавления коммента для схемы {request.SchemeId}");

            String Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            logger.LogInformation($"Извлеченный Sid пользователя: {Sid}");

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == request.SchemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync();


            if (availableScheme == null)
            {
                logger.LogInformation($"Схема недоступна");
                return;
            }

            if (availableScheme.Versions == null || !availableScheme.Versions.Any())
            {
                logger.LogInformation($"У схемы нет версий");
                return;
            }

            logger.LogInformation($"Схема доступна: {availableScheme.Name}");

            var version = availableScheme.Versions.First();
            var mappedVersion = VersionToDtoMapper.Map(version);

            string elementId = "";

            // проверка наличия элемента
            switch (request.ElementType)
            {
                case "block":
                    var block = mappedVersion.Code.Blocks
                        .FirstOrDefault(b => b.Id == request.ElementId);

                    if (block == null)
                        return;

                    elementId = request.ElementId;

                    break;
                case "connection":
                    var connection = mappedVersion.Code.Connections
                        .FirstOrDefault(c => c.Id == request.ElementId);

                    if (connection == null)
                        return;

                    elementId = request.ElementId;

                    break;
                default:
                    break;
            }

            Comment comment = new Comment
            {
                VersionID = version.Id,
                ElementID = elementId,
                UserID = Sid,
                Text = request.Text, 
                X = request.X, 
                Y = request.Y
            };

            context.Comments.Add(comment);
            await context.SaveChangesAsync();

            if (elementId == null || elementId == "")
            {
                //оповещение
                await Clients.OthersInGroup($"comments-{request.SchemeId}")
                    .SendAsync("CommentAdded", CommentToDtoMapper.Map(comment));

                //подтверждение пользователю
                await Clients.Caller.SendAsync("YourCommentAdded", CommentToDtoMapper.Map(comment));

                logger.LogInformation($"Клиент добавил коммент для всей схемы {request.SchemeId}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
            else
            {
                //оповещение
                await Clients.OthersInGroup($"comments-{request.SchemeId}-{elementId}")
                    .SendAsync("CommentAdded", CommentToDtoMapper.Map(comment));

                //подтверждение пользователю
                await Clients.Caller.SendAsync("YourCommentAdded", CommentToDtoMapper.Map(comment));

                logger.LogInformation($"Клиент добавил коммент для схемы {request.SchemeId} к элементу- {elementId}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
        }
    }
}
