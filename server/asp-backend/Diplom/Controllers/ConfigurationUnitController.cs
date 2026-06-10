using Diplom.Models.Requests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ConfigurationUnitController : Controller
    {
        [HttpGet]
        public async Task<List<CodeRequest>> GetAll()
        {
            // отправка запроса в Итилиум
            // var response
            // List<CodeRequest> units = DatabaseServiceFacilitySerializer.Serialize(response)
            // return units;
            return new List<CodeRequest>();
        }

        [HttpGet("by-name")]
        public async Task<CodeRequest> GetByName([FromBody] string unitName)
        {
            // отправка запроса в Итилиум
            // var response
            // List<CodeRequest> units = DatabaseServiceFacilitySerializer.Serialize(response)
            // return units;
            return new CodeRequest();
        }
    }
}
