using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class CommentUpdateRequest
    {
        [JsonPropertyName("commentId")]
        public int CommentId { get; set; }
        [JsonPropertyName("text")]
        public string Text { get; set; }
    }
}
