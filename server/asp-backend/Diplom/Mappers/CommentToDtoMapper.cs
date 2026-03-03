using Diplom.Models.DB;
using Diplom.Models.DTO;
using Diplom.Models.Requests;

namespace Diplom.Mappers
{
    public class CommentToDtoMapper
    {
        public static CommentDto Map(Comment comment)
        {
            return new CommentDto
            {
                ID = comment.ID,
                Version = comment.Version.Id, 
                ElementID = comment.ElementID,
                Date = comment.Date,
                UserID = comment.UserID,
                Text = comment.Text
            };
        }
    }
}
