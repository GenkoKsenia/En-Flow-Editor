using Azure.Core;
using Diplom.Mappers;
using Diplom.Models.DB;
using Diplom.Models.DTO;
using Diplom.Models.Hub;
using Diplom.Models.Requests.CommentRequests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System;
using System.Security.Cryptography;
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

        public async Task<IEnumerable<CommentDto>> JoinComments(int schemeId)
        {

            String Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            
            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.Comments)
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync();
            
            /*
            Models.DB.Version availableVersion = await context.Versions
                .Include(v => v.Comments)
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(v => v.Scheme.UserID == Sid ||
                    v.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    v.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(v => v.Id == versionId);
            */

            if (availableScheme == null)
                throw new HubException("Access denied");

            if (availableScheme.Versions == null || !availableScheme.Versions.Any())
                throw new HubException("Versions is null");


            await Groups.AddToGroupAsync(Context.ConnectionId, $"comments-{schemeId}");

            logger.LogInformation($"Клиент подключился к группе comments-{schemeId} и получил комменты. ConnectionId: {Context.ConnectionId}");


            var comments = availableScheme.Comments;

            return comments.Select(c => CommentToDtoMapper.Map(c));
        }

        public async Task LeaveElementComments(int schemeId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"comments-{schemeId}");

            logger.LogInformation($"Клиент отключился от группы comments-{schemeId}. ConnectionId: {Context.ConnectionId}");
        }

        public async Task SendComment(HubElementCommentRequest request)
        {
            logger.LogInformation($"Начало добавления коммента для схемы {request.SchemeId}");

            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            logger.LogInformation($"Извлеченный Sid пользователя: {Sid}");

            int editingRightLevel = 2;

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Versions.OrderByDescending(v => v.Date).Take(1))
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == request.SchemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync();
            

            /*
            Models.DB.Version availableVersion = await context.Versions
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(v => v.Scheme.UserID == Sid ||
                    v.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    v.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(v => v.Id == request.VersionId);
            */

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
                SchemeID = request.SchemeId,
                ElementID = elementId,
                UserID = Sid,
                Text = request.Text, 
                X = request.X, 
                Y = request.Y
            };

            context.Comments.Add(comment);
            await context.SaveChangesAsync();

            //оповещение
            await Clients.OthersInGroup($"comments-{request.SchemeId}")
                .SendAsync("CommentAdded", CommentToDtoMapper.Map(comment));

            //подтверждение пользователю
            await Clients.Caller.SendAsync("YourCommentAdded", CommentToDtoMapper.Map(comment));

            logger.LogInformation($"Клиент добавил коммент для схемы {request.SchemeId}. ConnectionId: {Context.ConnectionId}, Comment: {CommentToDtoMapper.Map(comment)}");
        }

        public async Task UpdateCommentText(CommentUpdateRequest request)
        {
            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            int editingRightLevel = 2;

            Comment availableComment = await context.Comments
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(c => c.Scheme.UserID == Sid ||
                    c.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    c.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync(c => c.ID == request.CommentId);


            if (availableComment == null)
                return;

            /*
            if (availableComment.UserID != Sid)
                return;
            */

            availableComment.Text = request.Text;
            await context.SaveChangesAsync();

            await Clients.Caller.SendAsync("CommentUpdated", 
                CommentToDtoMapper.Map(availableComment));

            //оповещение
            await Clients.OthersInGroup($"comments-{availableComment.SchemeID}")
                .SendAsync("CommentUpdated", CommentToDtoMapper.Map(availableComment));

            logger.LogInformation($"Клиент обновил коммент для схемы {availableComment.SchemeID}. ConnectionId: {Context.ConnectionId}, Comment: {CommentToDtoMapper.Map(availableComment)}");
        }

        public async Task UpdateCommentPosition(CommentPositionUpdateRequest request)
        {
            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            int editingRightLevel = 2;

            logger.LogInformation($"Поиск коммента ({request.CommentId})");

            Comment availableComment = await context.Comments
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(c => c.Scheme.UserID == Sid ||
                    c.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    c.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync(c => c.ID == request.CommentId);


            if (availableComment == null)
            {
                logger.LogInformation($"Коммент недоступен ({request.CommentId})");
                return;
            }

            string elementId = availableComment.ElementID;

            availableComment.X = request.X;
            availableComment.Y = request.Y;


            await context.SaveChangesAsync();

            await Clients.Caller.SendAsync("CommentMoved", CommentToDtoMapper.Map(availableComment));

            //оповещение
            await Clients.OthersInGroup($"comments-{availableComment.SchemeID}")
                .SendAsync("CommentMoved", CommentToDtoMapper.Map(availableComment));
        }

        public async Task CompleteComment(CommentCompleteRequest request)
        {
            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            int editingRightLevel = 2;

            logger.LogInformation($"Поиск коммента ({request.CommentId})");

            Comment availableComment = await context.Comments
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(c => c.Scheme.UserID == Sid ||
                    c.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    c.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync(c => c.ID == request.CommentId);

            if (availableComment == null)
            {
                logger.LogInformation($"Коммент недоступен ({request.CommentId})");
                return;
            }

            if (availableComment.CompletionDate != null)
            {
                logger.LogInformation($"Коммент уже завершен ({request.CommentId})");
                return;
            }

            string elementId = availableComment.ElementID;

            availableComment.CompletionDate = DateTime.Now;
            await context.SaveChangesAsync();

            await Clients.Caller.SendAsync("CommentCompleted", CommentToDtoMapper.Map(availableComment));

            //оповещение
            await Clients.OthersInGroup($"comments-{availableComment.SchemeID}")
                .SendAsync("CommentCompleted", CommentToDtoMapper.Map(availableComment));
        }

        public async Task DeleteComment(CommentDeleteRequest request)
        {
            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            int editingRightLevel = 2;

            logger.LogInformation($"Поиск коммента ({request.CommentId})");

            Comment availableComment = await context.Comments
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(c => c.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(c => c.Scheme.UserID == Sid ||
                    c.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    c.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync(c => c.ID == request.CommentId);

            if (availableComment == null)
            {
                logger.LogInformation($"Коммент недоступен ({request.CommentId})");
                return;
            }

            string elementId = availableComment.ElementID;

            context.Comments.Remove(availableComment);
            await context.SaveChangesAsync();

            await Clients.Caller.SendAsync("CommentDeleted", availableComment.ID);

            //оповещение
            await Clients.OthersInGroup($"comments-{availableComment.SchemeID}")
                .SendAsync("CommentDeleted", availableComment.ID);
        }
    }
}
