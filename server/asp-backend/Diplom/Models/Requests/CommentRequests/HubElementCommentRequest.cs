using System.Text.Json.Serialization;

namespace Diplom.Models.Requests.CommentRequests
{
    public class HubElementCommentRequest
    {
        [JsonPropertyName("schemeId")]
        public int SchemeId { get; set; }
        [JsonPropertyName("versionId")]
        public int VersionId { get; set; }
        [JsonPropertyName("elementId")]
        public string ElementId { get; set; }
        [JsonPropertyName("elementType")]
        public string ElementType { get; set; }
        [JsonPropertyName("text")]
        public string Text { get; set; }
        [JsonPropertyName("x")]
        public float X { get; set; }
        [JsonPropertyName("y")]
        public float Y { get; set; }
    }
}
