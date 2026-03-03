using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class HubElementCommentRequest
    {
        [JsonPropertyName("schemeId")]
        public int SchemeId { get; set; }
        [JsonPropertyName("elementId")]
        public string ElementId { get; set; }
        [JsonPropertyName("elementtype")]
        public string ElementType { get; set; }
        [JsonPropertyName("text")]
        public string Text {  get; set; }
        [JsonPropertyName("x")]
        public float X { get; set; }
        [JsonPropertyName("y")]
        public float Y { get; set; }
    }
}
