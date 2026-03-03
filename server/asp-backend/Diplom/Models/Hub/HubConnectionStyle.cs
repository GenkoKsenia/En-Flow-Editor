using Diplom.Models.Requests;
using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class HubConnectionStyle
    {
        [JsonPropertyName("dateTime")]
        public DateTime DateTime { get; set; }
        [JsonPropertyName("actionType")]
        public ActionType ActionType { get; set; }
        [JsonPropertyName("connectionStyle")]
        public ConnectionStyle ConnectionStyle { get; set; }
    }
}
