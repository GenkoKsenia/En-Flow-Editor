using System.ComponentModel.DataAnnotations;

namespace Diplom.Models.DB.TestAD
{
    public class AdUser
    {
        [Key]
        public string Sid { get; set; }
        [Required]
        public string Name { get; set; }
    }
}
