using Diplom.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccessGroupSchemaRightController : Controller
    {
        private ApplicationContext context;
        public AccessGroupSchemaRightController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet("{schemeId}")]
        public ActionResult<IEnumerable<Access_Group_Schema_Right>> GetRightsByScheme(int schemeId)
        {
            var scheme = context.Schemes.FirstOrDefault(s => s.ID == schemeId);

            if (scheme == null)
            {
                return NotFound();
            }

            var groupRights = context.Access_Group_Schema_Rights.Where(a => a.Scheme == scheme);

            return Ok(groupRights.ToListAsync());
        }

        [HttpGet("{id}")]
        public ActionResult<Access_Group_Schema_Right> GetById(int id)
        {
            var groupRight = context.Access_User_Schema_Rights.FirstOrDefault(r => r.ID == id);

            if (groupRight == null)
                return NotFound();

            return Ok(groupRight);
        }

        [HttpPost("post/{schemeId}-{groupId}-{rightId}")]
        public async Task<IActionResult> Post(int schemeId, string groupId, int rightId)
        {
            try
            {
                var groupRight = new Access_Group_Schema_Right { SchemeID = schemeId, GroupID = groupId, RightID = rightId };

                context.Access_Group_Schema_Rights.Add(groupRight);
                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно создана",
                    id = groupRight.ID,
                    data = groupRight
                });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при создании записи: {ex.Message}");
            }
        }

        [HttpPut("put/{id}-{schemeId}-{groupId}-{rightId}")]
        public async Task<IActionResult> Put(int id, int schemeId, string groupId, int rightId)
        {
            try
            {
                var groupRight = context.Access_Group_Schema_Rights.FirstOrDefault(r => r.ID == id);

                if (groupRight == null)
                    return NotFound();

                groupRight.SchemeID = schemeId;
                groupRight.GroupID = groupId;
                groupRight.RightID = rightId;

                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно обновлена",
                    id = groupRight.ID,
                    data = groupRight
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
                var groupRight = context.Access_Group_Schema_Rights.FirstOrDefault(r => r.ID == id);

                if (groupRight == null) 
                    return NotFound();

                context.Access_Group_Schema_Rights.Remove(groupRight);

                await context.SaveChangesAsync();

                return StatusCode(201, new { message = "Запись успешно удалена" });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при обновлении записи: {ex.Message}");
            }
        }
    }
}
