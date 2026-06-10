using System.Text.Json.Serialization;
using Diplom.Models.Requests;

namespace Diplom.Models.Hub
{
    public class HubStyles
    {
        [JsonPropertyName("blocks")]
        public List<HubBlockStyle>? Blocks { get; set; }

        [JsonPropertyName("connections")]
        public List<HubConnectionStyle>? Connections { get; set; }
    }
}
