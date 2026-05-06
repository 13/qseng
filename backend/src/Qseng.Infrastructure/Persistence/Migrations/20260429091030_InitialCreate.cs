using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Qseng.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "import_jobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RawText = table.Column<string>(type: "text", nullable: false),
                    ReportJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_jobs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "media",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    Url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    Caption = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_media", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "persons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LastName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MaidenName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Sex = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    birth_year = table.Column<int>(type: "integer", nullable: true),
                    birth_month = table.Column<int>(type: "integer", nullable: true),
                    birth_day = table.Column<int>(type: "integer", nullable: true),
                    birth_approx = table.Column<bool>(type: "boolean", nullable: true),
                    death_year = table.Column<int>(type: "integer", nullable: true),
                    death_month = table.Column<int>(type: "integer", nullable: true),
                    death_day = table.Column<int>(type: "integer", nullable: true),
                    death_approx = table.Column<bool>(type: "boolean", nullable: true),
                    BirthPlace = table.Column<string>(type: "text", nullable: true),
                    DeathPlace = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_persons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TreeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromPersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToPersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    StartYear = table.Column<int>(type: "integer", nullable: true),
                    StartMonth = table.Column<int>(type: "integer", nullable: true),
                    StartDay = table.Column<int>(type: "integer", nullable: true),
                    EndYear = table.Column<int>(type: "integer", nullable: true),
                    EndMonth = table.Column<int>(type: "integer", nullable: true),
                    EndDay = table.Column<int>(type: "integer", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_relationships", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "trees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trees", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsAdmin = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Language = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "de"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "timeline_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    start_year = table.Column<int>(type: "integer", nullable: true),
                    start_month = table.Column<int>(type: "integer", nullable: true),
                    start_day = table.Column<int>(type: "integer", nullable: true),
                    start_approx = table.Column<bool>(type: "boolean", nullable: true),
                    end_year = table.Column<int>(type: "integer", nullable: true),
                    end_month = table.Column<int>(type: "integer", nullable: true),
                    end_day = table.Column<int>(type: "integer", nullable: true),
                    end_approx = table.Column<bool>(type: "boolean", nullable: true),
                    Location = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    MetadataJson = table.Column<string>(type: "text", nullable: true),
                    IsAutoGenerated = table.Column<bool>(type: "boolean", nullable: false),
                    SourceRelationshipId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_timeline_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_timeline_events_persons_PersonId",
                        column: x => x.PersonId,
                        principalTable: "persons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_import_jobs_UserId",
                table: "import_jobs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_media_PersonId",
                table: "media",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_persons_TreeId",
                table: "persons",
                column: "TreeId");

            migrationBuilder.CreateIndex(
                name: "IX_persons_TreeId_LastName_FirstName",
                table: "persons",
                columns: new[] { "TreeId", "LastName", "FirstName" });

            migrationBuilder.CreateIndex(
                name: "IX_relationships_TreeId_FromPersonId",
                table: "relationships",
                columns: new[] { "TreeId", "FromPersonId" });

            migrationBuilder.CreateIndex(
                name: "IX_relationships_TreeId_FromPersonId_ToPersonId_Type",
                table: "relationships",
                columns: new[] { "TreeId", "FromPersonId", "ToPersonId", "Type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_relationships_TreeId_ToPersonId",
                table: "relationships",
                columns: new[] { "TreeId", "ToPersonId" });

            migrationBuilder.CreateIndex(
                name: "IX_timeline_events_PersonId",
                table: "timeline_events",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_trees_OwnerId",
                table: "trees",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true,
                filter: "\"Email\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                table: "users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "import_jobs");

            migrationBuilder.DropTable(
                name: "media");

            migrationBuilder.DropTable(
                name: "relationships");

            migrationBuilder.DropTable(
                name: "timeline_events");

            migrationBuilder.DropTable(
                name: "trees");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "persons");
        }
    }
}
