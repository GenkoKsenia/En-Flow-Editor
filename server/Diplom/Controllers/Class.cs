using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mime;
using System.Security.Claims;
using System.Security.Principal;


namespace Diplom.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        [HttpGet("current")]
        public IActionResult GetCurrentUser()
        {
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
                domainUser = new DomainUser { Sid = windowsIdentity.User.Value, Name = windowsIdentity.Name }, 
                isAuthenticated = windowsIdentity.IsAuthenticated,
                authenticationType = windowsIdentity.AuthenticationType,
                groups = groups, 
            };

            return Ok(userInfo);
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
    }
}
