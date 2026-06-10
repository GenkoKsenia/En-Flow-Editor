using System.Text.Json.Serialization;

namespace Diplom.Models.Hub
{
    public class LockedElementInfo
    {
        [JsonPropertyName("userId")]
        public string UserSid { get; set; }
        [JsonPropertyName("connectionId")]
        public string ConnectionId { get; set; }
        [JsonPropertyName("lockTime")]
        public DateTime LockTime { get; set; }
        [JsonPropertyName("elementType")]
        public string ElementType { get; set; }
        [JsonPropertyName("elementId")]
        public string ElementId { get; set; }
    }
}
