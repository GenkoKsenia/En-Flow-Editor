using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB
{
    public class FavoriteScheme
    {
        [Key]
        public int ID { get; set; }
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        [JsonIgnore]
        public virtual Scheme Scheme { get; set; }
        [Required]
        public string UserID { get; set; }
    }
}
