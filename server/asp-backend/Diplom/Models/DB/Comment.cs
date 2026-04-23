using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB
{
    public class Comment
    {
        [Key]
        public int ID { get; set; }
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        public Scheme Scheme { get; set; }
        [Required]
        public string ElementID { get; set; }
        [Required]
        public string UserID {  get; set; }
        [Required]
        public DateTime Date { get; set; } = DateTime.Now;
        public string Text {  get; set; }
        public DateTime? CompletionDate { get; set; }
        [Required]
        public float X {  get; set; }
        [Required]
        public float Y { get; set; }
    }
}
