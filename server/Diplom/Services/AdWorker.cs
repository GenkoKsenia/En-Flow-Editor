using Diplom.Models.DTO;
using System.DirectoryServices.AccountManagement;

namespace Diplom.Services
{
    public class AdWorker : IDomainWorker
    {
        public List<AdGroup> GetGroups()
        {
            List<AdGroup> allAdGroups = new List<AdGroup>();

            using (var context = new PrincipalContext(ContextType.Domain, "some.Domain"))
            {
                var groupPrinciple = new GroupPrincipal(context);

                using (var search = new PrincipalSearcher(groupPrinciple))
                {
                    foreach (GroupPrincipal domainGroup in search.FindAll())
                    {
                        var adGroup = new AdGroup()
                        {
                            Name = domainGroup.Name,
                            Sid = domainGroup.Sid.ToString()
                        };

                        allAdGroups.Add(adGroup);
                    }
                }
            }

            return allAdGroups;
        }

        public List<AdGroup> GetGroupsByMatch(string text)
        {
            List<AdGroup> groups = new List<AdGroup>();

            using (var context = new PrincipalContext(ContextType.Domain, "some.domain"))
            {
                GroupPrincipal groupPrincipal = new GroupPrincipal(context)
                {
                    Name = $"*{text}*"
                };

                using (var search = new PrincipalSearcher(groupPrincipal))
                {
                    foreach (GroupPrincipal group in search
                        .FindAll()
                        .OrderBy(g => g.Name))
                    {
                        var adGroup = new AdGroup()
                        {
                            Name = group.Name,
                            Sid = group.Sid.ToString()
                        };

                        groups.Add(adGroup);
                    }
                }
            }

            return groups;
        }

        public List<AdUser> GetUsers()
        {
            List<AdUser> allAdUsers = new List<AdUser>();

            using (var context = new PrincipalContext(ContextType.Domain, "some.Domain"))
            {
                var userPrinciple = new UserPrincipal(context);

                using (var search = new PrincipalSearcher(userPrinciple))
                {
                    foreach (UserPrincipal domainUser in search
                        .FindAll().
                        OrderBy(u => u.DisplayName))
                    {
                        var adUser = new AdUser()
                        {
                            Sid = domainUser.Sid.ToString(),
                            Name = domainUser.Name
                        };

                        allAdUsers.Add(adUser);
                    }
                }
            }

            return allAdUsers;
        }

        public List<AdUser> GetUsersByMatch(string text)
        {
            List<AdUser> users = new List<AdUser>();

            using (var context = new PrincipalContext(ContextType.Domain, "some.Domain"))
            {
                UserPrincipal userPrincipal = new UserPrincipal(context)
                {
                    DisplayName = $"*{text}*"
                };

                using (var search = new PrincipalSearcher(userPrincipal))
                {

                    foreach (UserPrincipal domainUser in search
                        .FindAll()
                        .OrderBy(u => u.DisplayName))
                    {
                        var adUser = new AdUser
                        {
                            Sid = domainUser.Sid.ToString(),
                            Name = domainUser.Name
                        };
                    }

                    /*
                    var directorySearcher = search.GetUnderlyingSearcher() as DirectorySearcher;

                    if (directorySearcher == null)
                    {
                        return new List<AdUser>();
                    }

                    directorySearcher.Filter =
                         $"(&(objectClass=user)(objectCategory=person)(displayName=*{displayName}*))";

                    directorySearcher.Sort = new SortOption("displayName", SortDirection.Ascending);

                    foreach (SearchResult result in directorySearcher.FindAll())
                    {
                        using (DirectoryEntry directoryEntry = result.GetDirectoryEntry())
                        {
                            AdUser adUser = ConvertDirectoryEntryToAdUser(directoryEntry);

                            users.Add(adUser);
                        }
                    }
                    */
                }
            }

            return users;
        }
    }
}
