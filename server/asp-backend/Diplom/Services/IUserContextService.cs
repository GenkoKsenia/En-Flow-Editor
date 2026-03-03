using System.Security.Principal;

namespace Diplom.Services
{
    public interface IUserContextService
    {
        string GetCurrentUserSid();
        List<string> GetCurrentUserGroups();
        WindowsIdentity GetCurrentWindowsIdentity();
    }
}
