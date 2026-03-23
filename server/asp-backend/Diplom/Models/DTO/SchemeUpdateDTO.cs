using Diplom.Models.DB;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using Diplom.Models.Hub;

namespace Diplom.Models.DTO
{
    public class SchemeUpdateDTO
    {
        public int ID { get; set; }
        public int SchemeID { get; set; }
        public DateTime? SendDateTime { get; set; } = DateTime.UtcNow;
        public string ConnectionID { get; set; }
        public bool IsSent { get; set; }
        public HubCodeRequest Updates { get; set; }
    }
}
