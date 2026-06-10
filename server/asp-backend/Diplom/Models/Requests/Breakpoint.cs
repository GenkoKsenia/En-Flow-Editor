using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class Breakpoint
    {
        [JsonPropertyName("x")]
        public float X { get; set; }

        [JsonPropertyName("y")]
        public float Y { get; set; }
    }
}
