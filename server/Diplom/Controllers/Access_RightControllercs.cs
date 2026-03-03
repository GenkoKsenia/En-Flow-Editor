using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Emit;
using System.Security.Principal;
using Microsoft.AspNetCore.Authorization;
using Diplom.Models.DB;
using Diplom.Models.Requests;

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

        [HttpPost("post")]
        public async Task<Access_Right> Post([FromBody] AccessRightRequest request)
        {
            Access_Right right = new Access_Right { Level = request.level, Title = request.title };

            context.Access_Rights.Add(right);
            await context.SaveChangesAsync();

            return right;
        }

        [HttpPut("put/{id}")]
        public async Task<Access_Right> Put(int id, [FromBody] AccessRightRequest request)
        {
            Access_Right right = await context.Access_Rights.FirstOrDefaultAsync(r => r.ID == id);

            right.Level = request.level;
            right.Title = request.title;

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
