using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Diplom.Migrations
{
    /// <inheritdoc />
    public partial class UpdatedComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Comments_Versions_VersionID",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "IsReadOnly",
                table: "Schemes");

            migrationBuilder.RenameColumn(
                name: "VersionID",
                table: "Comments",
                newName: "SchemeID");

            migrationBuilder.RenameIndex(
                name: "IX_Comments_VersionID",
                table: "Comments",
                newName: "IX_Comments_SchemeID");

            migrationBuilder.AddColumn<bool>(
                name: "IsReadOnly",
                table: "Versions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddForeignKey(
                name: "FK_Comments_Schemes_SchemeID",
                table: "Comments",
                column: "SchemeID",
                principalTable: "Schemes",
                principalColumn: "ID",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Comments_Schemes_SchemeID",
                table: "Comments");

            migrationBuilder.DropColumn(
                name: "IsReadOnly",
                table: "Versions");

            migrationBuilder.RenameColumn(
                name: "SchemeID",
                table: "Comments",
                newName: "VersionID");

            migrationBuilder.RenameIndex(
                name: "IX_Comments_SchemeID",
                table: "Comments",
                newName: "IX_Comments_VersionID");

            migrationBuilder.AddColumn<bool>(
                name: "IsReadOnly",
                table: "Schemes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddForeignKey(
                name: "FK_Comments_Versions_VersionID",
                table: "Comments",
                column: "VersionID",
                principalTable: "Versions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
