using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using System.Security.Claims;
using System.Security.Principal;
using System.DirectoryServices.AccountManagement;
using Diplom.Services;
using Diplom.DBContexts;


namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : Controller
    {
        private IUserContextService userContextService;

        public UserController(IUserContextService _userContextService)
        {
            userContextService = _userContextService;
        }

        [HttpGet("current")]
        public IActionResult GetCurrentUser()
        {
            /*
            var windowsIdentity = HttpContext.User.Identity as WindowsIdentity;

            if (windowsIdentity == null || !windowsIdentity.IsAuthenticated)
            {
                return Unauthorized(new { error = "Windows аутентификация не выполнена" });
            }

            var groups = new List<Group>();
            foreach (var group in windowsIdentity.Groups)
            {
                try
                {
                    var ntAccount = group.Translate(typeof(System.Security.Principal.NTAccount)) as NTAccount;

                    groups.Add(new Group { Name = ntAccount?.Value ?? group.Value, Sid = group.Value});
                }
                catch
                {
                    groups.Add(new Group { Name = group.Value, Sid = group.Value });
                }
            }

            var userInfo = new
            {
                domainUser = new DomainUser { 
                    Sid = windowsIdentity.User.Value, 
                    Name = windowsIdentity.Name, 
                    DisplayName = GetAdUserName(windowsIdentity.User.Value)
                }, 
                isAuthenticated = windowsIdentity.IsAuthenticated,
                authenticationType = windowsIdentity.AuthenticationType,
                groups = groups, 
            };
            */

            var windowsIdentity = userContextService.GetCurrentWindowsIdentity();

            return Ok(new
            {
                Sid = windowsIdentity.User?.Value, 
                Name = windowsIdentity.Name
            });
        }

        private string GetAdUserName(string Sid)
        {
            using (var context = new PrincipalContext(ContextType.Domain, "some.Domain"))
            {
                var user = UserPrincipal.FindByIdentity(context, IdentityType.Sid, Sid);

                if (user == null)
                {
                    return "";
                }

                return user.DisplayName;
            }
        }
    }

    public class Group
    {
        public string Name { get; set; }
        public string Sid { get; set; }
    }

    public class DomainUser
    {
        public string Sid { get; set; }
        public string Name { get; set; }
        public string DisplayName { get; set; }
    }
}
