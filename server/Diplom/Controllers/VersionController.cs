using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Diplom.Models;
using Microsoft.AspNetCore.Authorization;
using System.Security.Principal;
using System.DirectoryServices;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class VersionController : Controller
    {
        private ApplicationContext context;

        public VersionController(ApplicationContext _context)
        {
            context = _context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Models.Version>>> Get()
        {
            return Ok(await context.Versions.ToListAsync());
        }

        [HttpGet("{schemeId}")]
        public async Task<ActionResult<IEnumerable<Models.Version>>> GetAllVersionsByScheme(int schemeId)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            String Sid = windowsIdentity.User.Value;
            var groups = windowsIdentity.Groups
                .Cast<IdentityReference>()
                .Select(g => g.Value)
                .ToList();

            return Ok(await context.Versions
                .Include(v => v.Scheme)
                .Include(v => v.Scheme.Access_User_Schema_Rights)
                .Include(v => v.Scheme.Access_Group_Schema_Rights)
                .Where(v => v.Scheme.ID == schemeId)
                .Where(v => v.Scheme.UserID == Sid || 
                    v.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    v.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .ToListAsync()
            );
        }

        [HttpPost("post/{schemeId}")]
        public async Task<ActionResult<Models.Version>> Post(int schemeId, [FromBody] string code)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            String Sid = windowsIdentity.User.Value;
            var groups = windowsIdentity.Groups
                .Cast<IdentityReference>()
                .Select(g => g.Value)
                .ToList();

            int editingRightLevel = 2;

            /*
            bool hasEditingRights = await context.Schemes
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .AnyAsync();
            */

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(s => s.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(s => s.ID == schemeId)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync();

            if (availableScheme == null)
                return Forbid();

            Models.Version version = new Models.Version { Code = code, SchemeID = schemeId };

            context.Versions.Add(version);
            await context.SaveChangesAsync();

            return version;
        }

        [HttpPut("put/{id}-{code}")]
        public async Task<ActionResult<Models.Version>> Put(int id, string code)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            String Sid = windowsIdentity.User.Value;
            var groups = windowsIdentity.Groups
                .Cast<IdentityReference>()
                .Select(g => g.Value)
                .ToList();

            int editingRightLevel = 2;

            Models.Version version = await context.Versions
                .Include(v => v.Scheme)
                .Include(v => v.Scheme.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(v => v.Scheme.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Where(v => v.Id == id)
                .Where(v => v.Scheme.UserID == Sid ||
                    v.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                    v.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel))
                .FirstOrDefaultAsync();

            if (version == null)
                return Forbid();

            version.Code = code;
            await context.SaveChangesAsync();

            return version;
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            String Sid = windowsIdentity.User.Value;
            var groups = windowsIdentity.Groups
                .Cast<IdentityReference>()
                .Select(g => g.Value)
                .ToList();

            Models.Version version = await context.Versions
                .Include(v => v.Scheme)
                .Include(v => v.Scheme.Access_User_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .Include(v => v.Scheme.Access_Group_Schema_Rights)
                    .ThenInclude(r => r.Access_Right)
                .FirstOrDefaultAsync(v => v.Id == id);

            int editingRightLevel = 2;

            bool hasEditingRights = version.Scheme.UserID != Sid ||
                version.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid && r.Access_Right.Level == editingRightLevel) ||
                version.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID) && r.Access_Right.Level == editingRightLevel);

            if (!hasEditingRights)
                return Forbid();

            context.Versions.Remove(version);
            await context.SaveChangesAsync();

            return Ok();
        }
    }
}
