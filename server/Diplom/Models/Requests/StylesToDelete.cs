using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class StylesToDelete
    {
        [JsonPropertyName("blocksId")]
        public List<string>? BlockStylesIds { get; set; }

        [JsonPropertyName("connectionIds")]
        public List<string>? ConnectionStyleIds { get; set; }
    }
}
