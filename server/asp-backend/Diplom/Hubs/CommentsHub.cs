using Azure.Core;
using Diplom.Mappers;
using Diplom.Models.DB;
using Diplom.Models.Hub;
using Diplom.Models.Requests;
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

        public async Task<IEnumerable<Comment>> JoinElementComments(int versionId, string elementId)
        {

            String Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            /*
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
            */

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


            if (availableVersion == null)
                throw new HubException("Access denied");

            //Models.DB.Version version = availableScheme.Versions.First();

            if (elementId == null || elementId == "")
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"comments-{availableVersion.Id}");

                logger.LogInformation($"Клиент подключился к группе comments-{availableVersion.Id} и получил комменты. ConnectionId: {Context.ConnectionId}");
            }
            else
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"comments-{availableVersion.Id}-{elementId}");

                logger.LogInformation($"Клиент подключился к группе comments-{availableVersion.Id}-{elementId} и получил комменты. ConnectionId: {Context.ConnectionId}");
            }

            var comments = availableVersion.Comments
                .Where(c => c.ElementID == elementId);

            return comments;
        }

        public async Task LeaveElementComments(int versionId, string elementId)
        {
            if (elementId == null || elementId == "")
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"comments-{versionId}");

                logger.LogInformation($"Клиент отключился от группы comments-{versionId}. ConnectionId: {Context.ConnectionId}");
            }
            else
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"comments-{versionId}-{elementId}");

                logger.LogInformation($"Клиент отключился от группы comments-{versionId}-{elementId}. ConnectionId: {Context.ConnectionId}");
            }
        }

        public async Task SendComment(HubElementCommentRequest request)
        {
            logger.LogInformation($"Начало добавления коммента для версии {request.VersionId}");

            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            logger.LogInformation($"Извлеченный Sid пользователя: {Sid}");

            /*
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
            */

            Models.DB.Version availableVersion = await context.Versions
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(v => v.Scheme.UserID == Sid ||
                    v.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    v.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(v => v.Id == request.VersionId);

            if (availableVersion == null)
            {
                logger.LogInformation($"Версия схемы недоступна");
                return;
            }

            logger.LogInformation($"Версия схемы доступна: {availableVersion.Scheme.Name}");

            //var version = availableScheme.Versions.First();
            var mappedVersion = VersionToDtoMapper.Map(availableVersion);

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
                VersionID = availableVersion.Id,
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
                await Clients.OthersInGroup($"comments-{request.VersionId}")
                    .SendAsync("CommentAdded", CommentToDtoMapper.Map(comment));

                //подтверждение пользователю
                await Clients.Caller.SendAsync("YourCommentAdded", CommentToDtoMapper.Map(comment));

                logger.LogInformation($"Клиент добавил коммент для всей схемы {request.VersionId}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
            else
            {
                //оповещение
                await Clients.OthersInGroup($"comments-{request.VersionId}-{elementId}")
                    .SendAsync("CommentAdded", CommentToDtoMapper.Map(comment));

                //подтверждение пользователю
                await Clients.Caller.SendAsync("YourCommentAdded", CommentToDtoMapper.Map(comment));

                logger.LogInformation($"Клиент добавил коммент для схемы {request.VersionId} к элементу- {elementId}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
        }

        public async Task UpdateCommentText(CommentUpdateRequest request)
        {
            string Sid = GetCurrentUserSid();

            Comment comment = await context.Comments
                .FirstOrDefaultAsync(c => c.ID == request.CommentId);

            if (comment == null)
                return;

            if (comment.UserID != Sid)
                return;

            comment.Text = request.Text;
            await context.SaveChangesAsync();

            await Clients.Caller.SendAsync("YourCommentUpdated", comment);

            
            if (comment.ElementID == null || comment.ElementID == "")
            {
                //оповещение
                await Clients.OthersInGroup($"comments-{comment.VersionID}")
                    .SendAsync("CommentAdded", CommentToDtoMapper.Map(comment));

                logger.LogInformation($"Клиент добавил коммент для версии {comment.VersionID}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
            else
            {
                //оповещение
                await Clients.OthersInGroup($"comments-{comment.VersionID}-{comment.ElementID}")
                    .SendAsync("CommentAdded", CommentToDtoMapper.Map(comment));

                logger.LogInformation($"Клиент добавил коммент для версии {comment.VersionID} к элементу- {comment.ElementID}. ConnectionId: {Context.ConnectionId}, Comment: {comment}");
            }
        }

        public async Task UpdateCommentPosition(CommentPositionUpdateRequest request)
        {
            string Sid = GetCurrentUserSid();
            var groups = GetCurrentUserGroups();

            Models.DB.Version availableVersion = await context.Versions
                .Include(v => v.Comments)
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_User_Schema_Rights)
                .Include(v => v.Scheme)
                    .ThenInclude(s => s.Access_Group_Schema_Rights)
                .Where(v => v.Scheme.UserID == Sid ||
                    v.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    v.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(v => v.Id == request.VersionId);

            if (availableVersion == null)
                return;

            string elementId = request.ElementId == null ?
                "" : request.ElementId;

            List<Comment> comments = availableVersion.Comments
                .Where(c => c.ElementID == elementId)
                .ToList();

            //TODO: у каждого коммента же ведь свои координаты, у каждого должны быть свои
            foreach (var comment in comments)
            {
                comment.X += request.X;
                comment.Y += request.Y;
            }

            await context.SaveChangesAsync();

            await Clients.Caller.SendAsync("CommentsMoved", comments);

            if (request.ElementId == null || request.ElementId == "")
            {
                //оповещение
                await Clients.OthersInGroup($"comments-{request.VersionId}")
                    .SendAsync("CommentsMoved", comments.Select(c => CommentToDtoMapper.Map(c)));
            }
            else
            {
                //оповещение
                await Clients.OthersInGroup($"comments-{request.VersionId}-{request.ElementId}")
                    .SendAsync("CommentsMoved", comments.Select(c => CommentToDtoMapper.Map(c)));
            }
        }
    }
}
