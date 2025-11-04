using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VersionController : Controller
    {
        private ApplicationContext context;

        public VersionController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet]
        public ActionResult<IEnumerable<Models.Version>> Get()
        {
            return Ok(context.Versions.ToListAsync());
        }

        [HttpGet("{schemeId}")]
        public ActionResult<IEnumerable<Models.Version>> GetAllVersionsByScheme(int schemeId)
        {
            var scheme = context.Schemes.FirstOrDefault(s => s.ID == schemeId);

            if (scheme == null)
            {
                return NotFound();
            }

            var versions = context.Versions.Where(v => v.Scheme ==  scheme);

            return Ok(versions.ToListAsync());
        }

        [HttpPost("post/{schemeId}")]
        public async Task<IActionResult> Post(int schemeId, [FromBody] string code)
        {
            try
            {
                var version = new Models.Version { Code = code, SchemeID = schemeId };

                context.Versions.Add(version);
                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно создана",
                    id = version.Id,
                    data = version
                });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка: {ex.Message}");
            }
        }

        [HttpPut("put/{id}-{code}")]
        public async Task<IActionResult> Put(int id, string code)
        {

            try
            {
                var version = context.Versions.FirstOrDefault(v => v.Id == id);

                if (version == null)
                    return NotFound();

                version.Code = code;

                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно обновлена",
                    id = version.Id,
                    data = version
                });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при обновлении: {ex.Message}");
            }
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var version = context.Versions.FirstOrDefault(v => v.Id == id);

                if (version == null)
                    return NotFound();

                context.Versions.Remove(version);
                await context.SaveChangesAsync();

                return StatusCode(201, new { message = "Запись успешно удалена" });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при удалении: {ex.Message}");
            }
        }
    }
}
