using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Diplom.Models.DTO
{
    public class CommentDto
    {
        [JsonPropertyName("id")]
        public int ID { get; set; }
        [JsonPropertyName("schemeId")]
        public int SchemeID { get; set; }
        [JsonPropertyName("elementId")]
        public string ElementID { get; set; }
        [JsonPropertyName("user")]
        public string UserID { get; set; }
        [JsonPropertyName("creationDate")]
        public DateTime Date { get; set; }
        [JsonPropertyName("text")]
        public string Text { get; set; }
        [JsonPropertyName("completionDate")]
        public DateTime? CompletionDate { get; set; }
        [JsonPropertyName("x")]
        public float X { get; set; }
        [JsonPropertyName("y")]
        public float Y { get; set; }
    }
}
