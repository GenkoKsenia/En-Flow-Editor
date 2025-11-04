using Diplom.Models;
using Microsoft.EntityFrameworkCore;

namespace Diplom
{
    public class ApplicationContext : DbContext
    {
        public DbSet<Scheme> Schemes { get; set; } = null;
        public DbSet<Models.Version> Versions { get; set; } = null;
        public DbSet<Access_Right> Access_Rights { get; set; } = null;
        public DbSet<Access_User_Schema_Right> Access_User_Schema_Rights { get; set; } = null;
        public DbSet<Access_Group_Schema_Right> Access_Group_Schema_Rights { get; set; } = null;

        public ApplicationContext(DbContextOptions<ApplicationContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            //Version
            modelBuilder.Entity<Models.Version>()
                .HasOne(s => s.Scheme)
                .WithMany(v => v.Versions)
                .HasForeignKey(v => v.SchemeID);

            //Access_User_Schema_Right
            modelBuilder.Entity<Access_User_Schema_Right>()
                .HasOne(a => a.Access_Right)
                .WithMany(ar => ar.Access_User_Schema_Rights)
                .HasForeignKey(a => a.RightID);

            modelBuilder.Entity<Access_User_Schema_Right>()
                .HasOne(a => a.Scheme)
                .WithMany(ar => ar.Access_User_Schema_Rights)
                .HasForeignKey(a => a.SchemeID);

            //Access_Group_Schema_Right
            modelBuilder.Entity<Access_Group_Schema_Right>()
                .HasOne(a => a.Access_Right)
                .WithMany(ar => ar.Access_Group_Schema_Rights)
                .HasForeignKey(a => a.RightID);

            modelBuilder.Entity<Access_Group_Schema_Right>()
                .HasOne(a => a.Scheme)
                .WithMany(ar => ar.Access_Group_Schema_Rights)
                .HasForeignKey(a => a.SchemeID);
        }
    }
}
