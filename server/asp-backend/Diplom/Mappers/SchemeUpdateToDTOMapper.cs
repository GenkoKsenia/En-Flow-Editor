using Diplom.Models.DB;
using Diplom.Models.DTO;
using Diplom.Models.Hub;
using Diplom.Models.Requests;
using System;
using System.Text.Json;

namespace Diplom.Mappers
{
    public class SchemeUpdateToDTOMapper
    {
        public static SchemeUpdateDTO Map(SchemeUpdate schemeUpdate)
        {
            return new SchemeUpdateDTO
            {
                ID = schemeUpdate.ID,
                SchemeID = schemeUpdate.SchemeID,
                SendDateTime = schemeUpdate.SendDateTime,
                ConnectionID = schemeUpdate.ConnectionID,
                IsSent = schemeUpdate.IsSent,
                Updates = JsonSerializer.Deserialize<HubCodeRequest>(schemeUpdate.Updates)
            };
        }
    }
}
