using Diplom.Models.DB.Main;
using Diplom.Models.DB.TestAD;
using Microsoft.EntityFrameworkCore;

namespace Diplom.DBContexts
{
    public class TestADContext: DbContext
    {
        public DbSet<AdGroup> AdGroups { get; set; } = null;
        public DbSet<AdUser> AdUsers { get; set; } = null;

        public TestADContext(DbContextOptions<TestADContext> options)
            : base(options)
        {
        }
    }
}
