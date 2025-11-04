using Diplom.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Emit;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class Access_RightController : Controller
    {
        private ApplicationContext context;
        public Access_RightController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Access_Right>>> GetAll()
        {
            var rights = await context.Access_Rights.ToListAsync();
            return Ok(rights);
        }

        [HttpGet("{id}")]
        public ActionResult<Access_Right> GetById(int id)
        {
            var right = context.Access_Rights.FirstOrDefault(r => r.ID == id);

            if (right == null)
                return NotFound();

            return Ok(right);
        }

        [HttpPost("post/{level}-{title}")]
        public async Task<IActionResult> Post(int level, string title)
        {
            var right = new Access_Right { Level = level, Title = title };

            context.Access_Rights.Add(right);
            await context.SaveChangesAsync();

            return StatusCode(201, new
            {
                message = "Запись успешно создана",
                id = right.ID,
                data = right
            });
        }

        [HttpPut("put/{id}-{level}-{title}")]
        public async Task<IActionResult> Put(int id, int level, string title)
        {
            try
            {
                var right = context.Access_Rights.FirstOrDefault(r => r.ID == id);

                if (right == null)
                    return NotFound($"Запись с ID {id} не найдена");

                right.Level = level;
                right.Title = title;

                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно обновлена",
                    id = right.ID,
                    data = right
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Ошибка при обновлении: {ex.Message}");
            }
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var right = context.Access_Rights.FirstOrDefault(r => r.ID == id);

                if (right == null)
                    return NotFound();

                context.Access_Rights.Remove(right);

                await context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Ошибка при удалении: {ex.Message}");
            }
        }
    }
}
