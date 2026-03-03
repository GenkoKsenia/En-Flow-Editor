using System.Text.Json.Serialization;
using Diplom.Models.Requests;

namespace Diplom.Models.Hub
{
    public class HubCodeRequest
    {
        [JsonPropertyName("blocks")]
        public List<HubBlock>? Blocks { get; set; }

        [JsonPropertyName("dataFlows")]
        public List<HubDataFlow>? DataFlows { get; set; }

        [JsonPropertyName("connections")]
        public List<HubConnection>? Connections { get; set; }

        [JsonPropertyName("styles")]
        public HubStyles? HubStyles { get; set; }
    }
}
