using System.Data;
using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class Styles
    {
        [JsonPropertyName("blocks")]
        public List<BlockStyle> Blocks { get; set; } = new();

        [JsonPropertyName("connections")]
        public List<ConnectionStyle> Connections { get; set; } = new();
    }
}
