using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class ConnectionStyle
    {
        [JsonPropertyName("elementId")]
        public string ElementId { get; set; } = "";

        [JsonPropertyName("color")]
        public string Color { get; set; } = "";

        [JsonPropertyName("width")]
        public float Width { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; } = "";
    }
}
