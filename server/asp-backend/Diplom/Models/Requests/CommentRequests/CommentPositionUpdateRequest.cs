using System.Text.Json.Serialization;

namespace Diplom.Models.Requests.CommentRequests
{
    public class CommentPositionUpdateRequest
    {
        [JsonPropertyName("schemeId")]
        public int SchemeId { get; set; }
        [JsonPropertyName("versionId")]
        public int VersionId { get; set; }
        [JsonPropertyName("commentId")]
        public int CommentId { get; set; }
        [JsonPropertyName("x")]
        public float X { get; set; }
        [JsonPropertyName("y")]
        public float Y { get; set; }
    }
}
