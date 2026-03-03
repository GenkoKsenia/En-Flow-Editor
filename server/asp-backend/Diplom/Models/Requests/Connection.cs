using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class Connection
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("startBlock")]
        public string StartBlock { get; set; } = "";

        [JsonPropertyName("endBlock")]
        public string EndBlock { get; set; } = "";

        [JsonPropertyName("startSide")]
        public string StartSide { get; set; } = "";

        [JsonPropertyName("endSide")]
        public string EndSide { get; set; } = "";

        [JsonPropertyName("label")]
        public string Label { get; set; } = "";

        [JsonPropertyName("dataKeys")]
        public List<string> DataKeys { get; set; } = new();

        [JsonPropertyName("through")]
        public List<string> Through { get; set; } = new();

        [JsonPropertyName("breakpoints")]
        public List<Breakpoint> Breakpoints { get; set; } = new();
    }
}
