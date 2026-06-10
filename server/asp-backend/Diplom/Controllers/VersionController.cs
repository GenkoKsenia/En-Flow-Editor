using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Principal;
using System.DirectoryServices;
using Diplom.Services;
using System.Text.Json;
using Diplom.Mappers;
using Diplom.Models.DTO;
using Diplom.Models.Requests;
using Diplom.DBContexts;
using Diplom.Models.DB.Main;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class VersionController : Controller
    {
        private ApplicationContext context;
        private IUserContextService userContextService;
        public VersionController(ApplicationContext _context, IUserContextService _userContextService)
        {
            context = _context;
            userContextService = _userContextService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Models.DB.Main.Version>>> Get()
        {
            return Ok(await context.Versions.ToListAsync());
        }

        [HttpGet("{schemeId}")]
        public async Task<ActionResult<IEnumerable<VersionResponseDto>>> GetAllVersionsByScheme(int schemeId)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            List<Models.DB.Main.Version> versions = await context.Versions
                .Include(v => v.Scheme)
                .Include(v => v.Scheme.Access_User_Schema_Rights)
                .Include(v => v.Scheme.Access_Group_Schema_Rights)
                .Where(v => v.Scheme.ID == schemeId)
                .Where(v => v.Scheme.UserID == Sid ||
                    v.Scheme.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    v.Scheme.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .ToListAsync();

            return Ok(
                versions.Select(v => VersionToDtoMapper.Map(v)).ToList()
            );
        }

        [HttpPost("post/{schemeId}")]
        public async Task<ActionResult<VersionResponseDto>> Post(int schemeId, [FromBody] CodeRequest request)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

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

            string pseudoCode = JsonSerializer.Serialize(request);

            Models.DB.Main.Version version = new Models.DB.Main.Version { Code = pseudoCode, SchemeID = schemeId };

            context.Versions.Add(version);
            await context.SaveChangesAsync();

            return VersionToDtoMapper.Map(version);
        }

        [HttpPut("put/{id}")]
        public async Task<ActionResult<VersionResponseDto>> Put(int id, [FromBody] CodeRequest request)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            int editingRightLevel = 2;

            Models.DB.Main.Version version = await context.Versions
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

            if (version.IsReadOnly)
                return Forbid();

            string pseudoCode = JsonSerializer.Serialize(request);

            version.Code = pseudoCode;
            await context.SaveChangesAsync();

            return VersionToDtoMapper.Map(version);
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            Models.DB.Main.Version version = await context.Versions
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

        [HttpPost("lock/{id}")]
        public async Task<IActionResult> SetReadOnly(int id, [FromBody] bool isReadOnly)
        {
            string Sid = userContextService.GetCurrentUserSid();

            Models.DB.Main.Version version = await context.Versions
                .Include(v => v.Scheme)
                .FirstOrDefaultAsync(v => v.Id == id);

            if (version == null)
                return Forbid();

            if (version.Scheme.UserID != Sid)
                return Unauthorized();


            version.IsReadOnly = isReadOnly;
            await context.SaveChangesAsync();
            return Ok();
        }
    }
}
