using Diplom.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Principal;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AccessGroupSchemaRightController : Controller
    {
        private ApplicationContext context;
        public AccessGroupSchemaRightController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet("{schemeId}")]
        public async Task<ActionResult<IEnumerable<Access_Group_Schema_Right>>> GetRightsByScheme(int schemeId)
        {
            return Ok(
                await context.Access_Group_Schema_Rights
                .Include(a => a.Access_Right)
                .Where(a => a.SchemeID == schemeId)
                .ToListAsync()
                );
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Access_Group_Schema_Right>> GetById(int id)
        {
            return Ok(await context.Access_User_Schema_Rights
                .Include(a => a.Access_Right)
                .FirstOrDefaultAsync(r => r.ID == id)
                );
        }

        [HttpPost("post/{schemeId}-{rightId}")]
        public async Task<ActionResult<Access_Group_Schema_Right>> Post(int schemeId, [FromBody] string groupId, int rightId)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;
            String Sid = windowsIdentity.User.Value;

            Scheme scheme = await context.Schemes.FirstOrDefaultAsync(s => s.ID == schemeId);

            if (scheme.UserID == Sid)
                return Unauthorized();

            Access_Group_Schema_Right groupRight = new Access_Group_Schema_Right { SchemeID = schemeId, GroupID = groupId, RightID = rightId };

            context.Access_Group_Schema_Rights.Add(groupRight);
            await context.SaveChangesAsync();

            return groupRight;
        }

        [HttpPut("put/{id}-{schemeId}-{rightId}")]
        public async Task<ActionResult<Access_Group_Schema_Right>> Put(int id, int schemeId, [FromBody] string groupId, int rightId)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;
            String Sid = windowsIdentity.User.Value;

            Access_Group_Schema_Right groupRight = await context.Access_Group_Schema_Rights
                .Include(r => r.Scheme)
                .FirstOrDefaultAsync(r => r.ID == id);

            if (groupRight.Scheme.UserID == Sid)
                return Unauthorized();

            groupRight.SchemeID = schemeId;
            groupRight.GroupID = groupId;
            groupRight.RightID = rightId;

            await context.SaveChangesAsync();

            return groupRight;
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;
            String Sid = windowsIdentity.User.Value;

            Access_Group_Schema_Right groupRight = await context.Access_Group_Schema_Rights
                .Include(r => r.Scheme)
                .FirstOrDefaultAsync(r => r.ID == id);

            if (groupRight.Scheme.UserID == Sid)
                return Unauthorized();

            await context.Access_Group_Schema_Rights
                .Where(a => a.ID == id)
                .ExecuteDeleteAsync();

            return Ok();
        }
    }
}
