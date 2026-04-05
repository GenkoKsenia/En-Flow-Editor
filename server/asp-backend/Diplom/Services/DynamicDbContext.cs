using Diplom.Models.Requests;
using Microsoft.EntityFrameworkCore;
using System.Data.Common;

namespace Diplom.Services
{
    public class DynamicDbContext
    {
        public async Task<DbContext> CreateDbContext(DbConnectionRequest connection)
        {
            var optionsBuilder = new DbContextOptionsBuilder<DbContext>();

            string connectionString;

            if (connection.AuthenticationType == "windows")
            {
                connectionString = $"Server={connection.Server};Database={connection.Database};Trusted_Connection=True;TrustServerCertificate=True;";
            }
            else
            {
                connectionString = $"Server={connection.Server};Database={connection.Database};User Id={connection.Username};Password={connection.Password};TrustServerCertificate=True;";
            }

            optionsBuilder.UseSqlServer(connectionString);

            var dbContext = new DbContext(optionsBuilder.Options);

            await dbContext.Database.CanConnectAsync();

            return dbContext;
        }
    }
}
