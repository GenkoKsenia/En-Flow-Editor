using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB.Main
{
    public class Version
    {
        [Key]
        public int Id { get; set; }
        public bool IsReadOnly { get; set; } = false;
        public string Code { get; set; }
        [Required]
        public DateTime Date { get; set; } = DateTime.Now;
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        [JsonIgnore]
        public virtual Scheme Scheme { get; set; }
    }
}
