using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB.Main
{
    public class SchemeUpdate
    {
        [Key]
        public int ID { get; set; }
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        [JsonIgnore]
        public virtual Scheme Scheme { get; set; }
        public DateTime? SendDateTime { get; set; }
        public string ConnectionID { get; set; }
        public bool IsSent { get; set; } = false;
        public string? Updates { get; set; }
    }
}
