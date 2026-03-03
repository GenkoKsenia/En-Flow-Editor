using Diplom.Models.Requests;
using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class HubConnection
    {
        [JsonPropertyName("dateTime")]
        public DateTime DateTime { get; set; }
        [JsonPropertyName("actionType")]
        public ActionType ActionType { get; set; }
        [JsonPropertyName("connection")]
        public Connection Connection { get; set; }
    }
}
