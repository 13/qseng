using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Qseng.Infrastructure.Persistence.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class RelationshipLiveEdgeIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_relationships_TreeId_FromPersonId_ToPersonId_Type",
                table: "relationships");

            migrationBuilder.CreateIndex(
                name: "ix_relationships_live_edge",
                table: "relationships",
                columns: new[] { "TreeId", "FromPersonId", "ToPersonId", "Type" },
                unique: true,
                filter: "\"DeletedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_relationships_live_edge",
                table: "relationships");

            migrationBuilder.CreateIndex(
                name: "IX_relationships_TreeId_FromPersonId_ToPersonId_Type",
                table: "relationships",
                columns: new[] { "TreeId", "FromPersonId", "ToPersonId", "Type" },
                unique: true);
        }
    }
}
