using System.ComponentModel.DataAnnotations.Schema;

namespace Diplom.Models
{
    public class Access_Group_Schema_Right
    {
        public int ID { get; set; }
        public string GroupID { get; set; }
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        public Scheme Scheme { get; set; }
        [ForeignKey("Right")]
        public int RightID { get; set; }
        public Access_Right Access_Right { get; set; }
    }
}
