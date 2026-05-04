using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Diplom.Migrations
{
    /// <inheritdoc />
    public partial class AddedCompositeKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_FavoriteSchemes",
                table: "FavoriteSchemes");

            migrationBuilder.DropColumn(
                name: "ID",
                table: "FavoriteSchemes");

            migrationBuilder.AlterColumn<string>(
                name: "UserID",
                table: "FavoriteSchemes",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddPrimaryKey(
                name: "PK_FavoriteSchemes",
                table: "FavoriteSchemes",
                columns: new[] { "UserID", "SchemeID" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_FavoriteSchemes",
                table: "FavoriteSchemes");

            migrationBuilder.AlterColumn<string>(
                name: "UserID",
                table: "FavoriteSchemes",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AddColumn<int>(
                name: "ID",
                table: "FavoriteSchemes",
                type: "int",
                nullable: false,
                defaultValue: 0)
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AddPrimaryKey(
                name: "PK_FavoriteSchemes",
                table: "FavoriteSchemes",
                column: "ID");
        }
    }
}
