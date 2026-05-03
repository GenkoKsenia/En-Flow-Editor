using System.Text.Json.Serialization;

namespace Diplom.Models.Requests.CommentRequests
{
    public class JoinCommentsRequest
    {
        [JsonPropertyName("schemeId")]
        public int SchemeId { get; set; }
        [JsonPropertyName("versionId")]
        public int VersionId { get; set; }
    }
}
