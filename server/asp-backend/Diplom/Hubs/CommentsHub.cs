using Diplom.Mappers;
using Diplom.Models.DB;
using Diplom.Models.DTO;
using Diplom.Models.Hub;
using Diplom.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Principal;

namespace Diplom.Hubs
{
    [Authorize]
    public class CommentsHub : Hub
    {
        private readonly ApplicationContext context;
        private readonly ILogger<CommentsHub> logger;
        private readonly IUserDirectoryService userDirectoryService;

        public CommentsHub(
            ApplicationContext _context,
            ILogger<CommentsHub> _logger,
            IUserDirectoryService _userDirectoryService)
        {
            context = _context;
            logger = _logger;
            userDirectoryService = _userDirectoryService;
        }

        public override async Task OnConnectedAsync()
        {
            logger.LogInformation("Клиент подключился для просмотра комментов. ConnectionId: {ConnectionId}",
                Context.ConnectionId);

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            logger.LogInformation("Клиент отключился от комментов. ConnectionId: {ConnectionId}",
                Context.ConnectionId);
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

        public async Task<IEnumerable<CommentDto>> JoinElementComments(int schemeId, string elementId)
        {
            string sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                    .ThenInclude(v => v.Comments)
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync();

            if (availableScheme == null)
                throw new HubException("Access denied");

            if (availableScheme.Versions == null || !availableScheme.Versions.Any())
                throw new HubException("Versions is null");

            if (string.IsNullOrEmpty(elementId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"comments-{schemeId}");

                logger.LogInformation($"Клиент подключился к группе comments-{schemeId} и получил комменты. ConnectionId: {Context.ConnectionId}");
            }
            else
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"comments-{schemeId}-{elementId}");

                logger.LogInformation($"Клиент подключился к группе comments-{schemeId}-{elementId} и получил комменты. ConnectionId: {Context.ConnectionId}");
            }

            return availableScheme.Versions.First()
                .Comments
                .Where(c => c.ElementID == elementId)
                .Select(comment => CommentToDtoMapper.Map(comment, userDirectoryService))
                .ToList();
        }

        public async Task LeaveElementComments(int schemeId, string elementId)
        {
            if (string.IsNullOrEmpty(elementId))
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

            string sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            logger.LogInformation($"Извлеченный Sid пользователя: {sid}");

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == request.SchemeId)
                .Where(s => s.UserID == sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync();

            if (availableScheme == null)
            {
                logger.LogInformation("Схема недоступна");
                return;
            }

            if (availableScheme.Versions == null || !availableScheme.Versions.Any())
            {
                logger.LogInformation("У схемы нет версий");
                return;
            }

            logger.LogInformation($"Схема доступна: {availableScheme.Name}");

            var version = availableScheme.Versions.First();
            var mappedVersion = VersionToDtoMapper.Map(version);

            string elementId = string.Empty;

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
                UserID = sid,
                Text = request.Text,
                X = request.X,
                Y = request.Y
            };

            context.Comments.Add(comment);
            await context.SaveChangesAsync();

            var commentDto = CommentToDtoMapper.Map(comment, userDirectoryService);

            if (string.IsNullOrEmpty(elementId))
            {
                await Clients.OthersInGroup($"comments-{request.SchemeId}")
                    .SendAsync("CommentAdded", commentDto);

                await Clients.Caller.SendAsync("YourCommentAdded", commentDto);

                logger.LogInformation($"Клиент добавил коммент для всей схемы {request.SchemeId}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
            else
            {
                await Clients.OthersInGroup($"comments-{request.SchemeId}-{elementId}")
                    .SendAsync("CommentAdded", commentDto);

                await Clients.Caller.SendAsync("YourCommentAdded", commentDto);

                logger.LogInformation($"Клиент добавил коммент для схемы {request.SchemeId} к элементу- {elementId}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
        }
    }
}
