using Diplom.DBContexts;
using Diplom.Models.DB.Main;
using Diplom.Models.Requests;
using Diplom.Services;
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
        private IUserContextService userContextService;
        public AccessGroupSchemaRightController(ApplicationContext _context, IUserContextService _userContextService)
        {
            context = _context;
            userContextService = _userContextService;
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
        public async Task<ActionResult<Access_Group_Schema_Right>> Post(int schemeId, [FromBody] GroupAccessRequest request, int rightId)
        {
            string Sid = userContextService.GetCurrentUserSid();

            Scheme scheme = await context.Schemes.FirstOrDefaultAsync(s => s.ID == schemeId);

            if (scheme.UserID != Sid)
                return Unauthorized();

            Access_Group_Schema_Right groupRight = new Access_Group_Schema_Right { SchemeID = schemeId, GroupID = request.GroupId, RightID = rightId };

            context.Access_Group_Schema_Rights.Add(groupRight);
            await context.SaveChangesAsync();

            return await context.Access_Group_Schema_Rights
                .Include(r => r.Access_Right)
                .FirstOrDefaultAsync(r => r.ID == groupRight.ID);
        }

        [HttpPut("put/{id}-{schemeId}-{rightId}")]
        public async Task<ActionResult<Access_Group_Schema_Right>> Put(int id, int schemeId, [FromBody] GroupAccessRequest request, int rightId)
        {
            string Sid = userContextService.GetCurrentUserSid();

            Access_Group_Schema_Right groupRight = await context.Access_Group_Schema_Rights
                .Include(r => r.Scheme)
                .FirstOrDefaultAsync(r => r.ID == id);

            if (groupRight.Scheme.UserID != Sid)
                return Unauthorized();

            groupRight.SchemeID = schemeId;
            groupRight.GroupID = request.GroupId;
            groupRight.RightID = rightId;

            await context.SaveChangesAsync();

            return await context.Access_Group_Schema_Rights
                .Include(r => r.Access_Right)
                .FirstOrDefaultAsync(r => r.ID == groupRight.ID);
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            string Sid = userContextService.GetCurrentUserSid();

            Access_Group_Schema_Right groupRight = await context.Access_Group_Schema_Rights
                .Include(r => r.Scheme)
                .FirstOrDefaultAsync(r => r.ID == id);

            if (groupRight.Scheme.UserID != Sid)
                return Unauthorized();

            await context.Access_Group_Schema_Rights
                .Where(a => a.ID == id)
                .ExecuteDeleteAsync();

            return Ok();
        }
    }
}
