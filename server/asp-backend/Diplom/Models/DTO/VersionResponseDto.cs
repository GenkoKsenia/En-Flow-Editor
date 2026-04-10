using Diplom.Models.Requests;

namespace Diplom.Models.DTO
{
    public class VersionResponseDto
    {
        public int Id { get; set; }
        public bool IsReadOnly { get; set; }
        public CodeRequest Code { get; set; }
        public DateTime Date { get; set; }
        public int SchemeID { get; set; }
    }
}
