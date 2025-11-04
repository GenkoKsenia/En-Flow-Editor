using Diplom.Models;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Text.RegularExpressions;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SchemeController : Controller
    {
        private ApplicationContext context;
        public SchemeController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet]
        public ActionResult<IEnumerable<Scheme>> GetAll()
        {
            return Ok(context.Schemes.ToList());
        }

        [HttpGet("{id}")]
        public ActionResult<Scheme> GetById(int id)
        {
            var scheme = context.Schemes.FirstOrDefault(s => s.ID == id);

            if (scheme == null)
                return NotFound();

            return Ok(scheme);
        }

        [HttpGet("{userId}-{groupId}")]
        public ActionResult<IEnumerable<Scheme>> GetSchemesByUser(string userId, string groupId)
        {
            var schemes = context.Schemes
                .Where(s => s.UserID == userId || 
                s.Access_User_Schema_Rights.Any(r => r.UserID == userId) || 
                s.Access_Group_Schema_Rights.Any(r => r.GroupID == groupId))
                .Distinct()
                .ToList();

            return  Ok(schemes.ToList());
        }

        [HttpPost("post/{userId}")]
        public async Task<IActionResult> Post(string userId)
        {
            try
            {
                var scheme = new Scheme { UserID = userId };

                context.Schemes.Add(scheme);

                await context.SaveChangesAsync();

                return StatusCode(201, new
                {
                    message = "Запись успешно создана",
                    id = scheme.ID,
                    data = scheme
                });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка: {ex.Message}"); 
            }
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var scheme = context.Schemes.FirstOrDefault(s => s.ID == id);

                if (scheme == null)
                    return NotFound();

                context.Schemes.Remove(scheme);

                await context.SaveChangesAsync();

                return StatusCode(201, new{ message = "Запись успешно удалена" });
            }
            catch(Exception ex)
            {
                return StatusCode(500, $"Ошибка при удалении: {ex.Message}");
            }
        }
    }
}
