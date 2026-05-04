using Diplom.Models.DTO;
using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class CommentAfterActionResponse
    {
        [JsonPropertyName("versionId")]
        public int VersionId { get; set; }
        [JsonPropertyName("comment")]
        public CommentDto CommentDto { get; set; }
    }
}
