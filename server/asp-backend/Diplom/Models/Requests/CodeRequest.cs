using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class CodeRequest
    {
        [JsonPropertyName("blocks")]
        public List<Block> Blocks { get; set; } = new();

        [JsonPropertyName("dataFlows")]
        public List<DataFlow> DataFlows { get; set; } = new();

        [JsonPropertyName("connections")]
        public List<Connection> Connections { get; set; } = new();

        [JsonPropertyName("styles")]
        public Styles Styles { get; set; } = new();
    }
}
