using Diplom.Models.DTO;
using Diplom.Models.Requests;
using System.Text.Json;

namespace Diplom.Mappers
{
    public class VersionToDtoMapper
    {
        public static VersionResponseDto Map(Models.DB.Version version)
        {
            return new VersionResponseDto
            {
                Id = version.Id,
                Code = JsonSerializer.Deserialize<CodeRequest>(version.Code),
                Date = version.Date,
                SchemeID = version.SchemeID
            };
        }
    }
}
