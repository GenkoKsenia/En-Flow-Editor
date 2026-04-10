using Diplom.Models.DB;
using Diplom.Models.DTO;
using Diplom.Models.Requests;
using System.Text.Json;

namespace Diplom.Mappers
{
    public class SchemeToDtoMapper
    {
        public static SchemeResponseDto Map(Scheme scheme, bool isFavorite)
        {
            return new SchemeResponseDto
            {
                ID = scheme.ID,
                Name = scheme.Name,
                isFavorite = isFavorite, 
                UserID = scheme.UserID,
                Versions = scheme.Versions.Select(v => new VersionResponseDto
                {
                    Id = v.Id,
                    IsReadOnly = v.IsReadOnly, 
                    Code = JsonSerializer.Deserialize<CodeRequest>(v.Code),
                    Date = v.Date,
                    SchemeID = v.SchemeID
                }).ToList(),
                Access_User_Schema_Rights = scheme.Access_User_Schema_Rights.ToList(),
                Access_Group_Schema_Rights = scheme.Access_Group_Schema_Rights.ToList()
            };
        }
    }
}
