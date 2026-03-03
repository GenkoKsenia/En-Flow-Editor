using Diplom.Models.Requests;
using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class HubDataFlow
    {
        [JsonPropertyName("dateTime")]
        public DateTime DateTime { get; set; }
        [JsonPropertyName("actionType")]
        public ActionType ActionType { get; set; }
        [JsonPropertyName("dataFlow")]
        public DataFlow DataFlow { get; set; }
    }
}
