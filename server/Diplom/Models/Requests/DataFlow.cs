using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class DataFlow
    {
        [JsonPropertyName("dataKey")]
        public string DataKey { get; set; } = "";

        [JsonPropertyName("dataName")]
        public string DataName { get; set; } = "";

        [JsonPropertyName("startBlock")]
        public string StartBlock { get; set; } = "";

        [JsonPropertyName("finishBlocks")]
        public List<string> FinishBlocks { get; set; } = new();
    }
}
