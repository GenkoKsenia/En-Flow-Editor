using System.Text.Json.Serialization;

namespace Diplom.Models.Requests.CommentRequests
{
    public class CommentDeleteRequest
    {
        [JsonPropertyName("schemeId")]
        public int SchemeId { get; set; }
        [JsonPropertyName("versionId")]
        public int VersionId { get; set; }
        [JsonPropertyName("commentId")]
        public int CommentId { get; set; }
    }
}
