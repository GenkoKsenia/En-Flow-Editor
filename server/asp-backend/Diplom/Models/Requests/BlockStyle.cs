using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class BlockStyle
    {
        [JsonPropertyName("elementId")]
        public string ElementId { get; set; } = "";

        [JsonPropertyName("color")]
        public string Color { get; set; } = "";

        [JsonPropertyName("borderColor")]
        public string BorderColor { get; set; } = "";

        [JsonPropertyName("borderWidth")]
        public float BorderWidth { get; set; }
        [JsonPropertyName("borderRadius")]
        public float BorderRadius { get; set; }

        [JsonPropertyName("borderStyle")]
        public string BorderStyle { get; set; } = "";
    }
}
