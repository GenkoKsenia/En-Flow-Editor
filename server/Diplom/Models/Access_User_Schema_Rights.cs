using System.ComponentModel.DataAnnotations.Schema;

namespace Diplom.Models
{
    public class Access_User_Schema_Right
    {
        public int ID { get; set; }
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        public Scheme Scheme { get; set; }
        public string UserID { get; set; }
        [ForeignKey("Right")]
        public int RightID { get; set; }
        public Access_Right Access_Right { get; set; }
    }
}
