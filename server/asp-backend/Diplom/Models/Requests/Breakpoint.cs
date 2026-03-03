using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class Breakpoint
    {
        [JsonPropertyName("x")]
        public int X { get; set; }

        [JsonPropertyName("y")]
        public int Y { get; set; }
    }
}
