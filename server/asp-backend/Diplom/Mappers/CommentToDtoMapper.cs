using Diplom.Models.DB;
using Diplom.Models.DTO;
using Diplom.Services;

namespace Diplom.Mappers
{
    public class CommentToDtoMapper
    {
        public static CommentDto Map(Comment comment, IUserDirectoryService userDirectoryService)
        {
            return new CommentDto
            {
                ID = comment.ID,
                Version = comment.Version?.Id ?? comment.VersionID,
                ElementID = comment.ElementID,
                Date = comment.Date,
                UserID = userDirectoryService.ResolveDisplayName(comment.UserID),
                Text = comment.Text,
                X = comment.X,
                Y = comment.Y,
            };
        }
    }
}
