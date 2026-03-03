using System.ComponentModel.DataAnnotations;

namespace Diplom.Models.DB
{
    public class Scheme
    {
        [Key]
        public int ID { get; set; }
        [Required]
        public string Name { get; set; } = "Untitled";
        public bool IsReadOnly { get; set; } = false;
        [Required]
        public string UserID { get; set; }
        public virtual ICollection<Version> Versions { get; set; } = new List<Version>();
        public virtual ICollection<Access_User_Schema_Right> Access_User_Schema_Rights { get; set; } = new List<Access_User_Schema_Right>();
        public virtual ICollection<Access_Group_Schema_Right> Access_Group_Schema_Rights { get; set; } = new List<Access_Group_Schema_Right>();
    }
}
