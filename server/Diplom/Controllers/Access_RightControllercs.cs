using Diplom.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Emit;
using System.Security.Principal;
using Microsoft.AspNetCore.Authorization;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
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
            return Ok(await context.Access_Rights.ToListAsync());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Access_Right>> GetById(int id)
        {
            return Ok(await context.Access_Rights.FirstOrDefaultAsync(r => r.ID == id));
        }

        [HttpPost("post/{level}-{title}")]
        public async Task<Access_Right> Post(int level, string title)
        {
            Access_Right right = new Access_Right { Level = level, Title = title };

            context.Access_Rights.Add(right);
            await context.SaveChangesAsync();

            return right;
        }

        [HttpPut("put/{id}-{level}-{title}")]
        public async Task<Access_Right> Put(int id, int level, string title)
        {
            Access_Right right = await context.Access_Rights.FirstOrDefaultAsync(r => r.ID == id);

            right.Level = level;
            right.Title = title;

            await context.SaveChangesAsync();

            return right;
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            await context.Access_Rights
                .Where(a => a.ID == id)
                .ExecuteDeleteAsync();

            return Ok();
        }
    }
}
