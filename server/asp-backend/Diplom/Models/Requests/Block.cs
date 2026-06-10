using System.Text.Json.Serialization;

namespace Diplom.Models.Requests
{
    public class Block
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("information")]
        public List<string> Information { get; set; } = new();

        [JsonPropertyName("position")]
        public Position Position { get; set; } = new();

        [JsonPropertyName("width")]
        public float Width { get; set; }

        [JsonPropertyName("height")]
        public float Height { get; set; }

        [JsonPropertyName("parentId")]
        public string? ParentId { get; set; }
    }
}
