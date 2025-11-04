using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Diplom.Models
{
    public class Version
    {
        [Key]
        public int Id { get; set; }
        public string Code { get; set; }
        [Required]
        public DateTime Date { get; set; } = DateTime.Now;
        [ForeignKey("Scheme")]
        public int SchemeID {  get; set; }
        public virtual Scheme Scheme {  get; set; }
    }
}
