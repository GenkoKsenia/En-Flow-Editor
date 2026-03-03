using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB
{
    public class Version
    {
        [Key]
        public int Id { get; set; }
        public string Code { get; set; }
        [Required]
        public DateTime Date { get; set; } = DateTime.Now;
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        [JsonIgnore]
        public virtual Scheme Scheme { get; set; }
        [JsonIgnore]
        public virtual ICollection<Comment> Comments { get; set; } = new List<Comment>();
    }
}
