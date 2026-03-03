using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB
{
    public class Access_Right
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int ID { get; set; }
        [Required]
        public int Level { get; set; }
        [Required]
        public string Title { get; set; }
        [JsonIgnore]
        public virtual ICollection<Access_User_Schema_Right> Access_User_Schema_Rights { get; set; } = new List<Access_User_Schema_Right>();
        [JsonIgnore]
        public virtual ICollection<Access_Group_Schema_Right> Access_Group_Schema_Rights { get; set; } = new List<Access_Group_Schema_Right>();
    }
}
