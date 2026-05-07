using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class GetVersionsChangesRequest
    {
        [JsonPropertyName("scheme")]
        public int SchemeId { get; set; }
        [JsonPropertyName("versionId")]
        public int VersionId { get; set; }
    }
}
