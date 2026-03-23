using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Diplom.Migrations
{
    /// <inheritdoc />
    public partial class AddedFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SchemeUpdates");

            migrationBuilder.CreateTable(
                name: "FavoriteSchemes",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchemeID = table.Column<int>(type: "int", nullable: false),
                    UserID = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FavoriteSchemes", x => x.ID);
                    table.ForeignKey(
                        name: "FK_FavoriteSchemes_Schemes_SchemeID",
                        column: x => x.SchemeID,
                        principalTable: "Schemes",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FavoriteSchemes_SchemeID",
                table: "FavoriteSchemes",
                column: "SchemeID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FavoriteSchemes");

            migrationBuilder.CreateTable(
                name: "SchemeUpdates",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchemeID = table.Column<int>(type: "int", nullable: false),
                    ConnectionID = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsSent = table.Column<bool>(type: "bit", nullable: false),
                    SendDateTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Updates = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SchemeUpdates", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SchemeUpdates_Schemes_SchemeID",
                        column: x => x.SchemeID,
                        principalTable: "Schemes",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SchemeUpdates_SchemeID",
                table: "SchemeUpdates",
                column: "SchemeID");
        }
    }
}
