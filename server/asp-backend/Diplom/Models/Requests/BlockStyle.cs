using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class BlockStyle
    {
        [JsonPropertyName("element_id")]
        public string ElementId { get; set; } = "";

        [JsonPropertyName("color")]
        public string Color { get; set; } = "";

        [JsonPropertyName("border_color")]
        public string BorderColor { get; set; } = "";

        [JsonPropertyName("border_width")]
        public int BorderWidth { get; set; }

        [JsonPropertyName("border_style")]
        public string BorderStyle { get; set; } = "";
    }
}
