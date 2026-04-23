using System.Text.Json.Serialization;

namespace Diplom.Models.Requests.CommentRequests
{
    public class CommentCompleteRequest
    {
        [JsonPropertyName("id")]
        public int CommentId { get; set; }
    }
}
