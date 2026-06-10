using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Diplom.Migrations
{
    /// <inheritdoc />
    public partial class CreateInitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Access_Rights",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Level = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Access_Rights", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "Schemes",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserID = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Schemes", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "Access_Group_Schema_Rights",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupID = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SchemeID = table.Column<int>(type: "int", nullable: false),
                    RightID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Access_Group_Schema_Rights", x => x.ID);
                    table.ForeignKey(
                        name: "FK_Access_Group_Schema_Rights_Access_Rights_RightID",
                        column: x => x.RightID,
                        principalTable: "Access_Rights",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Access_Group_Schema_Rights_Schemes_SchemeID",
                        column: x => x.SchemeID,
                        principalTable: "Schemes",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Access_User_Schema_Rights",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchemeID = table.Column<int>(type: "int", nullable: false),
                    UserID = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RightID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Access_User_Schema_Rights", x => x.ID);
                    table.ForeignKey(
                        name: "FK_Access_User_Schema_Rights_Access_Rights_RightID",
                        column: x => x.RightID,
                        principalTable: "Access_Rights",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Access_User_Schema_Rights_Schemes_SchemeID",
                        column: x => x.SchemeID,
                        principalTable: "Schemes",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Versions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SchemeID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Versions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Versions_Schemes_SchemeID",
                        column: x => x.SchemeID,
                        principalTable: "Schemes",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Access_Group_Schema_Rights_RightID",
                table: "Access_Group_Schema_Rights",
                column: "RightID");

            migrationBuilder.CreateIndex(
                name: "IX_Access_Group_Schema_Rights_SchemeID",
                table: "Access_Group_Schema_Rights",
                column: "SchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_Access_User_Schema_Rights_RightID",
                table: "Access_User_Schema_Rights",
                column: "RightID");

            migrationBuilder.CreateIndex(
                name: "IX_Access_User_Schema_Rights_SchemeID",
                table: "Access_User_Schema_Rights",
                column: "SchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_Versions_SchemeID",
                table: "Versions",
                column: "SchemeID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Access_Group_Schema_Rights");

            migrationBuilder.DropTable(
                name: "Access_User_Schema_Rights");

            migrationBuilder.DropTable(
                name: "Versions");

            migrationBuilder.DropTable(
                name: "Access_Rights");

            migrationBuilder.DropTable(
                name: "Schemes");
        }
    }
}
