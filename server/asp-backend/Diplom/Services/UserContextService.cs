using System.Security.Principal;

namespace Diplom.Services
{
    public class UserContextService: IUserContextService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public UserContextService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public WindowsIdentity GetCurrentWindowsIdentity()
        {
            return _httpContextAccessor.HttpContext?.User.Identity as WindowsIdentity;
        }

        public string GetCurrentUserSid()
        {
            var identity = GetCurrentWindowsIdentity();
            return identity?.User?.Value;
        }

        public List<string> GetCurrentUserGroups()
        {
            var identity = GetCurrentWindowsIdentity();
            return identity?.Groups?
                .Cast<IdentityReference>()
                .Select(g => g.Value)
                .ToList() ?? new List<string>();
        }
    }
}
