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
    public class AccessUserSchemaRightsController : Controller
    {
        private ApplicationContext context;
        public AccessUserSchemaRightsController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet("{schemeId}")]
        public async Task<ActionResult<IEnumerable<Access_User_Schema_Right>>> GetRightsByScheme(int schemeId)
        {
            return Ok(await context.Access_User_Schema_Rights
                .Include(a => a.Access_Right)
                .Where(a => a.SchemeID == schemeId)
                .ToListAsync()
                );
        }

        [HttpGet("{id}")]
        public async Task<Access_User_Schema_Right> GetById(int id)
        {
            return await context.Access_User_Schema_Rights
                .Include(a => a.Access_Right)
                .FirstOrDefaultAsync(r => r.ID == id);
        }

        [HttpPost("post/{schemeId}-{rightId}")]
        public async Task<ActionResult<Access_User_Schema_Right>> Post(int schemeId, [FromBody] string userId, int rightId)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            String Sid = windowsIdentity.User.Value;

            Scheme scheme = await context.Schemes.FirstOrDefaultAsync(s => s.ID == schemeId);

            if (scheme.UserID != Sid)
                return Unauthorized();

            Access_User_Schema_Right userRight = new Access_User_Schema_Right { SchemeID = schemeId, UserID = userId, RightID = rightId };

            context.Access_User_Schema_Rights.Add(userRight);
            await context.SaveChangesAsync();

            return userRight;
        }

        [HttpPut("put/{id}-{schemeId}-{rightId}")]
        public async Task<ActionResult<Access_User_Schema_Right>> Put(int id, int schemeId, [FromBody] string userId, int rightId)
        {
            Access_User_Schema_Right userRight = await context.Access_User_Schema_Rights
                .Include(r => r.Scheme)
                .FirstOrDefaultAsync(r => r.ID == id);

            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;
            String Sid = windowsIdentity.User.Value;

            if (userRight.Scheme.UserID != Sid)
                return Unauthorized();

            userRight.SchemeID = schemeId;
            userRight.UserID = userId;
            userRight.RightID = rightId;

            await context.SaveChangesAsync();

            return userRight;
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;
            String Sid = windowsIdentity.User.Value;

            Access_User_Schema_Right userRight = await context.Access_User_Schema_Rights
                .Include(r => r.Scheme)
                .FirstOrDefaultAsync(r => r.ID == id);

            if (userRight.Scheme.UserID != Sid)
                return Unauthorized();

            context.Access_User_Schema_Rights.Remove(userRight);

            await context.SaveChangesAsync();

            return Ok();
        }
    }
}
