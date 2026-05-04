using Diplom.Models.DB.Main;
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
                SchemeID = comment.SchemeID, 
                ElementID = comment.ElementID,
                Date = comment.Date,
                UserID = comment.UserID,
                Text = comment.Text, 
                CompletionDate = comment.CompletionDate, 
                X = comment.X, 
                Y = comment.Y
            };
        }
    }
}