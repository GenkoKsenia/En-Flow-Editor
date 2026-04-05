using Diplom.Models.DB;
using Diplom.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FavoriteSchemeController: Controller
    {
        private ApplicationContext context;
        private IUserContextService userContextService;
        public FavoriteSchemeController(ApplicationContext _context, IUserContextService _userContextService)
        {
            context = _context;
            userContextService = _userContextService;
        }

        [HttpPost("post/{schemeId}")]
        public async Task<ActionResult<FavoriteScheme>> Post(int schemeId)
        {
            string Sid = userContextService.GetCurrentUserSid();
            var groups = userContextService.GetCurrentUserGroups();

            Scheme availableScheme = await context.Schemes
                .Include(s => s.Access_User_Schema_Rights)
                .Include(s => s.Access_Group_Schema_Rights)
                .Where(s => s.UserID == Sid ||
                    s.Access_User_Schema_Rights.Any(r => r.UserID == Sid) ||
                    s.Access_Group_Schema_Rights.Any(r => groups.Contains(r.GroupID)))
                .FirstOrDefaultAsync(s => s.ID == schemeId);

            if (availableScheme == null)
                return Unauthorized();

            FavoriteScheme favoriteScheme = new FavoriteScheme
            {
                UserID = Sid,
                SchemeID = schemeId
            };

            context.FavoriteSchemes.Add(favoriteScheme);
            await context.SaveChangesAsync();

            return favoriteScheme;
        }

        [HttpDelete("delete/{schemeId}")]
        public async Task<IActionResult> Delete(int schemeId)
        {
            string Sid = userContextService.GetCurrentUserSid();

            await context.FavoriteSchemes
                .Where(f => f.UserID == Sid && f.SchemeID == schemeId)
                .ExecuteDeleteAsync();

            return Ok();
        }
    }
}
