using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Qseng.Infrastructure.Persistence.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class AddSoftDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "timeline_events",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionBatchId",
                table: "timeline_events",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "relationships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionBatchId",
                table: "relationships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "persons",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionBatchId",
                table: "persons",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "media",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionBatchId",
                table: "media",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_timeline_events_DeletedAt",
                table: "timeline_events",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_relationships_DeletedAt",
                table: "relationships",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_persons_DeletedAt",
                table: "persons",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_media_DeletedAt",
                table: "media",
                column: "DeletedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_timeline_events_DeletedAt",
                table: "timeline_events");

            migrationBuilder.DropIndex(
                name: "IX_relationships_DeletedAt",
                table: "relationships");

            migrationBuilder.DropIndex(
                name: "IX_persons_DeletedAt",
                table: "persons");

            migrationBuilder.DropIndex(
                name: "IX_media_DeletedAt",
                table: "media");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "timeline_events");

            migrationBuilder.DropColumn(
                name: "DeletionBatchId",
                table: "timeline_events");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "relationships");

            migrationBuilder.DropColumn(
                name: "DeletionBatchId",
                table: "relationships");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "persons");

            migrationBuilder.DropColumn(
                name: "DeletionBatchId",
                table: "persons");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "media");

            migrationBuilder.DropColumn(
                name: "DeletionBatchId",
                table: "media");
        }
    }
}
