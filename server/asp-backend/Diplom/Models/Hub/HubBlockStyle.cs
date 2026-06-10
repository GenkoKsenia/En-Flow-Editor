using Diplom.Models.Requests;
using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class HubBlockStyle
    {
        [JsonPropertyName("dateTime")]
        public DateTime DateTime { get; set; }
        [JsonPropertyName("actionType")]
        public ActionType ActionType { get; set; }
        [JsonPropertyName("blockStyle")]
        public BlockStyle BlockStyle { get; set; }
    }
}
