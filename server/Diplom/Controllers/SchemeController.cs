using Diplom.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Security.Principal;
using System.Text.RegularExpressions;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SchemeController : Controller
    {
        private ApplicationContext context;
        public SchemeController(ApplicationContext _context)
        {
            context = _context;
        }

        /*
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Scheme>>> GetAll()
        {
            return Ok(await context.Schemes
                .Include(s => s.Versions)
                .Include(s => s.Access_User_Schema_Rights)
                .Include(s => s.Access_Group_Schema_Rights)
                .ToListAsync());
        }
        */

        [HttpGet("{id}")]
        public async Task<Scheme> GetById(int id) => await context.Schemes.FirstOrDefaultAsync(s => s.ID == id);

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Scheme>>> GetSchemesByUser()
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            String Sid = windowsIdentity.User.Value;
            var groups = windowsIdentity.Groups
                .Cast<IdentityReference>()
                .Select(g => g.Value)
                .ToList();

            return Ok(await context.Schemes
                .Include(s => s.Versions)
                .Include(s => s.Access_User_Schema_Rights)
                .Include(s => s.Access_Group_Schema_Rights)
                .Where(s => s.UserID == Sid ||
                s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .Distinct()
                .ToListAsync()
            );
        }

        [HttpPost("post/{name}")]
        public async Task<Scheme> Post(string name)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            String Sid = windowsIdentity.User.Value;

            Scheme scheme = new Scheme { Name = name, UserID = Sid };

            context.Schemes.Add(scheme);
            await context.SaveChangesAsync();

            return scheme;
        }

        [HttpPatch("patch/{id}-{name}")]
        public async Task<ActionResult<Scheme>> Patch(int id, string name)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;
            String Sid = windowsIdentity.User.Value;

            Scheme scheme = await context.Schemes.FirstOrDefaultAsync(s => s.ID == id);

            if (scheme.UserID == Sid)
                return Unauthorized();

            scheme.Name = name;
            await context.SaveChangesAsync();

            return scheme;
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;
            String Sid = windowsIdentity.User.Value;

            Scheme scheme = await context.Schemes.FirstOrDefaultAsync(s => s.ID == id);

            if (scheme.UserID != Sid)
                return Unauthorized();

            context.Schemes.Remove(scheme);

            return Ok();
        }
    }
}
