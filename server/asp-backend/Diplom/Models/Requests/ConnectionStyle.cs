using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class ConnectionStyle
    {
        [JsonPropertyName("element_id")]
        public string ElementId { get; set; } = "";

        [JsonPropertyName("color")]
        public string Color { get; set; } = "";

        [JsonPropertyName("width")]
        public int Width { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; } = "";
    }
}
