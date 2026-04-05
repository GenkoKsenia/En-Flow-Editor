using Diplom.Models.DB;
using Microsoft.EntityFrameworkCore;

namespace Diplom
{
    public class ApplicationContext : DbContext
    {
        public DbSet<Scheme> Schemes { get; set; } = null;
        public DbSet<Models.DB.Version> Versions { get; set; } = null;
        public DbSet<Comment> Comments { get; set; } = null;
        public DbSet<Access_Right> Access_Rights { get; set; } = null;
        public DbSet<Access_User_Schema_Right> Access_User_Schema_Rights { get; set; } = null;
        public DbSet<Access_Group_Schema_Right> Access_Group_Schema_Rights { get; set; } = null;
        //public DbSet<SchemeUpdate> SchemeUpdates { get; set; } = null;
        public DbSet<FavoriteScheme> FavoriteSchemes { get; set; } = null;

        public ApplicationContext(DbContextOptions<ApplicationContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            //Version
            modelBuilder.Entity<Models.DB.Version>()
                .HasOne(s => s.Scheme)
                .WithMany(v => v.Versions)
                .HasForeignKey(v => v.SchemeID);

            // FavoriteScheme
            modelBuilder.Entity<FavoriteScheme>()
                .HasKey(f => new { f.UserID, f.SchemeID });

            modelBuilder.Entity<FavoriteScheme>()
                .HasOne(f => f.Scheme)
                .WithMany(s => s.FavoriteSchemes)
                .HasForeignKey(f => f.SchemeID);

            /*SchemeUpdate
            modelBuilder.Entity<SchemeUpdate>()
                .HasOne(su => su.Scheme)
                .WithMany(s => s.SchemeUpdates)
                .HasForeignKey(su => su.SchemeID);
            */

            //Comment
            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Version)
                .WithMany(v => v.Comments)
                .HasForeignKey(c => c.VersionID);

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
