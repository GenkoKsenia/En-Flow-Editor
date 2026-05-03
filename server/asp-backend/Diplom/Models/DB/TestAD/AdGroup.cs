using System.ComponentModel.DataAnnotations;

namespace Diplom.Models.DB.TestAD
{
    public class AdGroup
    {
        [Key]
        public string Sid { get; set; }
        [Required]
        public string Name { get; set; }
    }
}
