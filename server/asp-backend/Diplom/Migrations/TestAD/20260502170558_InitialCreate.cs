using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Diplom.Migrations.TestAD
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdGroups",
                columns: table => new
                {
                    Sid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdGroups", x => x.Sid);
                });

            migrationBuilder.CreateTable(
                name: "AdUsers",
                columns: table => new
                {
                    Sid = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdUsers", x => x.Sid);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdGroups");

            migrationBuilder.DropTable(
                name: "AdUsers");
        }
    }
}
