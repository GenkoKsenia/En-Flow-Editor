using System.Collections.Concurrent;
using System.DirectoryServices.AccountManagement;
using System.Security.Principal;

namespace Diplom.Services
{
    public class UserDirectoryService : IUserDirectoryService
    {
        private const string DomainName = "some.Domain";

        private readonly ConcurrentDictionary<string, string> displayNameCache = new();

        public string ResolveDisplayName(string sid)
        {
            if (string.IsNullOrWhiteSpace(sid))
            {
                return string.Empty;
            }

            return displayNameCache.GetOrAdd(sid, ResolveDisplayNameUncached);
        }

        private static string ResolveDisplayNameUncached(string sid)
        {
            try
            {
                using var context = new PrincipalContext(ContextType.Domain, DomainName);
                var user = UserPrincipal.FindByIdentity(context, IdentityType.Sid, sid);

                if (!string.IsNullOrWhiteSpace(user?.DisplayName))
                {
                    return user.DisplayName;
                }

                if (!string.IsNullOrWhiteSpace(user?.Name))
                {
                    return user.Name;
                }
            }
            catch
            {
                // Fall through to translated account name or the raw SID.
            }

            try
            {
                var securityIdentifier = new SecurityIdentifier(sid);
                var account = securityIdentifier.Translate(typeof(NTAccount)) as NTAccount;
                if (!string.IsNullOrWhiteSpace(account?.Value))
                {
                    return account.Value;
                }
            }
            catch
            {
                // Ignore translation failures and return the original SID.
            }

            return sid;
        }
    }
}
