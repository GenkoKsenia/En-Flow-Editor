using Diplom.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccessUserSchemaRightsController : Controller
    {
        private ApplicationContext context;
        public AccessUserSchemaRightsController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet("{schemeId}")]
        public ActionResult<IEnumerable<Access_User_Schema_Right>> GetRightsByScheme(int schemeId)
        {
            var scheme = context.Schemes.FirstOrDefault(s => s.ID == schemeId);

            if (scheme == null)
            {
                return NotFound();
            }

            var userRights = context.Access_User_Schema_Rights.Where(a => a.Scheme == scheme);
            
            return Ok(userRights.ToListAsync());
        }

        [HttpGet("{id}")]
        public ActionResult<Access_User_Schema_Right> GetById(int id)
        {
            var userRight = context.Access_User_Schema_Rights.FirstOrDefault(r => r.ID == id);

            if (userRight == null)
                return NotFound();

            return Ok(userRight);
        }

        [HttpPost("post/{schemeId}-{userId}-{rightId}")]
        public async Task<IActionResult> Post(int schemeId, string userId, int rightId)
        {
            try
            {
                var userRight = new Access_User_Schema_Right { SchemeID = schemeId, UserID = userId, RightID = rightId };

                context.Access_User_Schema_Rights.Add(userRight);
                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно создана",
                    id = userRight.ID,
                    data = userRight
                });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при создании записи: {ex.Message}");
            }
        }

        [HttpPut("put/{id}-{schemeId}-{userId}-{rightId}")]
        public async Task<IActionResult> Put(int id, int schemeId, string userId, int rightId)
        {
            try
            {
                var userRight = context.Access_User_Schema_Rights.FirstOrDefault(r => r.ID == id);

                if (userRight == null)
                    return NotFound();

                userRight.SchemeID = schemeId;
                userRight.UserID = userId;
                userRight.RightID = rightId;

                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно обновлена",
                    id = userRight.ID,
                    data = userRight
                });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при обновлении записи: {ex.Message}");
            }
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var userRight = context.Access_User_Schema_Rights.FirstOrDefault(r => r.ID == id);

                if (userRight == null)
                    return NotFound();

                context.Access_User_Schema_Rights.Remove(userRight);

                await context.SaveChangesAsync();

                return StatusCode(201, new { message = "Запись успешно удалена" });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при удалении записи: {ex.Message}");
            }
        }
    }
}
