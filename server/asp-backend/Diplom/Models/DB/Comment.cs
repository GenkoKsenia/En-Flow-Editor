using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB
{
    public class Comment
    {
        [Key]
        public int ID { get; set; }
        [ForeignKey("Version")]
        public int VersionID { get; set; }
        public Version Version { get; set; }
        [Required]
        public string ElementID { get; set; }
        [Required]
        public string UserID {  get; set; }
        [Required]
        public DateTime Date { get; set; } = DateTime.Now;
        public string Text {  get; set; }
        [Required]
        public float X {  get; set; }
        [Required]
        public float Y { get; set; }
    }
}
