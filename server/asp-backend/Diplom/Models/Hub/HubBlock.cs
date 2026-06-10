using Diplom.Models.Requests;
using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class HubBlock
    {
        [JsonPropertyName("dateTime")]
        public DateTime DateTime { get; set; }

        [JsonPropertyName("actiontype")]
        public ActionType ActionType { get; set; }

        [JsonPropertyName("block")]
        public Block Block { get; set; }
    }
}
