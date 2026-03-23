using Diplom.Models.DB;

namespace Diplom.Models.DTO
{
    public class SchemeResponseDto
    {
        public int ID { get; set; }
        public string Name { get; set; }
        public bool IsReadOnly { get; set; }
        public bool isFavorite { get; set; } = false;
        public string UserID { get; set; }
        public virtual List<VersionResponseDto> Versions { get; set; } = new List<VersionResponseDto>();
        public virtual List<Access_User_Schema_Right> Access_User_Schema_Rights { get; set; } = new List<Access_User_Schema_Right>();
        public virtual List<Access_Group_Schema_Right> Access_Group_Schema_Rights { get; set; } = new List<Access_Group_Schema_Right>();
    }
}
