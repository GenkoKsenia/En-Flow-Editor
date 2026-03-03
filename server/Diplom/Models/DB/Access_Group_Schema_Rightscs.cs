using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Diplom.Models.DB
{
    public class Access_Group_Schema_Right
    {
        public int ID { get; set; }
        public string GroupID { get; set; }
        [ForeignKey("Scheme")]
        public int SchemeID { get; set; }
        [JsonIgnore]
        public Scheme Scheme { get; set; }
        [ForeignKey("Right")]
        public int RightID { get; set; }
        public Access_Right Access_Right { get; set; }
    }
}
