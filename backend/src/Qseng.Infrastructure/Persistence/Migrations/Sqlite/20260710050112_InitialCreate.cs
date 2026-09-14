using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Qseng.Infrastructure.Persistence.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SiteSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    RegistrationEnabled = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Username = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    IsAdmin = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    Language = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false, defaultValue: "de"),
                    TokenVersion = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TokenHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "trees",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OwnerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_trees_users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "import_jobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TreeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    RawText = table.Column<string>(type: "TEXT", nullable: false),
                    ReportJson = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_import_jobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_import_jobs_trees_TreeId",
                        column: x => x.TreeId,
                        principalTable: "trees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_import_jobs_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "persons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TreeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FirstName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    LastName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    MaidenName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Sex = table.Column<int>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    birth_year = table.Column<int>(type: "INTEGER", nullable: true),
                    birth_month = table.Column<int>(type: "INTEGER", nullable: true),
                    birth_day = table.Column<int>(type: "INTEGER", nullable: true),
                    birth_approx = table.Column<bool>(type: "INTEGER", nullable: true),
                    death_year = table.Column<int>(type: "INTEGER", nullable: true),
                    death_month = table.Column<int>(type: "INTEGER", nullable: true),
                    death_day = table.Column<int>(type: "INTEGER", nullable: true),
                    death_approx = table.Column<bool>(type: "INTEGER", nullable: true),
                    BirthPlace = table.Column<string>(type: "TEXT", nullable: true),
                    DeathPlace = table.Column<string>(type: "TEXT", nullable: true),
                    CauseOfDeath = table.Column<string>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_persons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_persons_trees_TreeId",
                        column: x => x.TreeId,
                        principalTable: "trees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "media",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PersonId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Url = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: false),
                    Caption = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    Kind = table.Column<int>(type: "INTEGER", nullable: false),
                    IsAvatar = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_media", x => x.Id);
                    table.ForeignKey(
                        name: "FK_media_persons_PersonId",
                        column: x => x.PersonId,
                        principalTable: "persons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TreeId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FromPersonId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ToPersonId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    StartYear = table.Column<int>(type: "INTEGER", nullable: true),
                    StartMonth = table.Column<int>(type: "INTEGER", nullable: true),
                    StartDay = table.Column<int>(type: "INTEGER", nullable: true),
                    EndYear = table.Column<int>(type: "INTEGER", nullable: true),
                    EndMonth = table.Column<int>(type: "INTEGER", nullable: true),
                    EndDay = table.Column<int>(type: "INTEGER", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_relationships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_relationships_persons_FromPersonId",
                        column: x => x.FromPersonId,
                        principalTable: "persons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_relationships_persons_ToPersonId",
                        column: x => x.ToPersonId,
                        principalTable: "persons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_relationships_trees_TreeId",
                        column: x => x.TreeId,
                        principalTable: "trees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "timeline_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PersonId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    start_year = table.Column<int>(type: "INTEGER", nullable: true),
                    start_month = table.Column<int>(type: "INTEGER", nullable: true),
                    start_day = table.Column<int>(type: "INTEGER", nullable: true),
                    start_approx = table.Column<bool>(type: "INTEGER", nullable: true),
                    end_year = table.Column<int>(type: "INTEGER", nullable: true),
                    end_month = table.Column<int>(type: "INTEGER", nullable: true),
                    end_day = table.Column<int>(type: "INTEGER", nullable: true),
                    end_approx = table.Column<bool>(type: "INTEGER", nullable: true),
                    Location = table.Column<string>(type: "TEXT", maxLength: 300, nullable: true),
                    MetadataJson = table.Column<string>(type: "TEXT", nullable: true),
                    IsAutoGenerated = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceRelationshipId = table.Column<Guid>(type: "TEXT", nullable: true),
                    StartSortKey = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
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
                    table.ForeignKey(
                        name: "FK_timeline_events_relationships_SourceRelationshipId",
                        column: x => x.SourceRelationshipId,
                        principalTable: "relationships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_import_jobs_TreeId",
                table: "import_jobs",
                column: "TreeId");

            migrationBuilder.CreateIndex(
                name: "IX_import_jobs_UserId",
                table: "import_jobs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "ix_media_person_avatar",
                table: "media",
                column: "PersonId",
                unique: true,
                filter: "\"IsAvatar\" = 1");

            migrationBuilder.CreateIndex(
                name: "IX_persons_TreeId",
                table: "persons",
                column: "TreeId");

            migrationBuilder.CreateIndex(
                name: "IX_persons_TreeId_LastName_FirstName",
                table: "persons",
                columns: new[] { "TreeId", "LastName", "FirstName" });

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_TokenHash",
                table: "refresh_tokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_UserId",
                table: "refresh_tokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_relationships_FromPersonId",
                table: "relationships",
                column: "FromPersonId");

            migrationBuilder.CreateIndex(
                name: "IX_relationships_ToPersonId",
                table: "relationships",
                column: "ToPersonId");

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
                name: "ix_timeline_events_person_sort",
                table: "timeline_events",
                columns: new[] { "PersonId", "StartSortKey" });

            migrationBuilder.CreateIndex(
                name: "IX_timeline_events_PersonId",
                table: "timeline_events",
                column: "PersonId");

            migrationBuilder.CreateIndex(
                name: "IX_timeline_events_SourceRelationshipId",
                table: "timeline_events",
                column: "SourceRelationshipId");

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
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "SiteSettings");

            migrationBuilder.DropTable(
                name: "timeline_events");

            migrationBuilder.DropTable(
                name: "relationships");

            migrationBuilder.DropTable(
                name: "persons");

            migrationBuilder.DropTable(
                name: "trees");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
