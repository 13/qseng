# P2a Soft Delete, Undo and Inline Add-Relative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deletes of persons, relationships, timeline events and media become reversible (backend trash with restore endpoints and a daily purge), the frontend shows an "Undo" toast instead of a confirm dialog for the three small entities, and the relationship dialog can create the related person inline.

**Architecture:** Four entities gain `DeletedAt`/`DeletionBatchId`; a global EF query filter hides trashed rows from every existing query; delete handlers stamp instead of removing; four `Restore` handlers clear the stamp (person restore revives its batch); `TrashPurger` hard-deletes rows older than the retention window and removes media files then. Frontend: `ToastService.undoable`, four call sites rewired, `RelationshipDialogComponent` gets a "New person" mode that creates then links, rolling back with a soft delete when linking fails.

**Tech Stack:** .NET 10, EF Core (SQLite + Postgres migration chains), MediatR, FluentValidation, xunit + NSubstitute + FluentAssertions; Angular 21 zoneless, Angular Material 21, Vitest 4, ng-openapi-gen.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-14-p2-ux-flows-design.md` §2, §3, §4, §8. Branch `feat/p2-ux-flows` (from `main` 7b72ad6).
- Backend contracts: `Result<T>` (`Ok`, `Fail(msg, status)`, `NotFound`, `Conflict`), ProblemDetails via `ToActionResult()`, every action annotated with `ProducesResponseType`, operationIds `<Controller>_<Action>`; ownership = `tree.OwnerId == _currentUser.UserId`; 404 before 403 when the row does not exist.
- After any controller/DTO change: `bash backend/export-openapi.sh` (writes `contracts/openapi.json`) then `npm run gen --prefix frontend`; both committed together.
- Migrations: one per provider, commands from `QsengDbContextFactory`: `dotnet ef migrations add AddSoftDelete --context SqliteQsengDbContext -o Persistence/Migrations/Sqlite` and `... --context PostgresQsengDbContext -o Persistence/Migrations/Postgres`, run from `backend/src/Qseng.Infrastructure` with `--startup-project ../Qseng.Api` (install `dotnet-ef` as a local tool if missing: `dotnet tool install dotnet-ef --create-manifest-if-needed`).
- Frontend contracts: `ToastService.errorFrom(err, fallback)`; dialogs own their requests, stay open on error (`setServerErrors`), close with the entity; `if (this.form.invalid) { markAllAsTouched(); return; }` first in every `save()`; i18n keys in BOTH `frontend/public/assets/i18n/{en,de}.json` (sorted, identical sets) + `npm run gen:i18n`; no `ngModel`; `npm run gates`, `ng lint`, `ng build` (budget 800 kB warning) and the suite green before every commit.
- Tooling: `cd` is broken in the sandbox shell — use `npm --prefix`, `git -C`, `dotnet test <path>`, absolute paths; `ng test --watch=false` inside `timeout 300`; stale vitest workers `ps -eo pid,args | grep "suppress-warn[i]ng" | awk '{print $1}' | xargs -r kill -9`; never `pkill -f`.
- Commit messages end with the attribution lines from the session's system reminder.

## File structure produced by this plan

```
backend/src/Qseng.Domain/Common/ISoftDeletable.cs                          new
backend/src/Qseng.Domain/Entities/{Person,Relationship,TimelineEvent,Media}.cs   DeletedAt, DeletionBatchId
backend/src/Qseng.Infrastructure/Persistence/QsengDbContext.cs             query filters
backend/src/Qseng.Infrastructure/Persistence/Configurations/*.cs           DeletedAt indexes
backend/src/Qseng.Infrastructure/Persistence/Migrations/{Sqlite,Postgres}/*AddSoftDelete*   new
backend/src/Qseng.Application/{Persons,Relationships,Timeline,Media}/Delete*/  stamp instead of remove
backend/src/Qseng.Application/{Persons/RestorePerson,Relationships/RestoreRelationship,Timeline/RestoreTimelineEvent,Media/RestoreMedia}/*.cs   new
backend/src/Qseng.Application/Trash/{TrashOptions,TrashPurger}.cs           new
backend/src/Qseng.Infrastructure/Trash/TrashPurgeService.cs                 new hosted service
backend/src/Qseng.Api/Controllers/{Persons,Relationships,Timeline,Media}Controller.cs   Restore actions
backend/tests/Qseng.Application.Tests/Trash/{SoftDeleteTests,RestoreTests,TrashPurgerTests}.cs   new
contracts/openapi.json                                                       regenerated
frontend/src/app/core/ui/toast.service.ts (+ spec)                          undoable()
frontend/src/app/features/persons/{person-family,person-media,relationship-dialog}.component.ts, features/timeline/timeline.component.ts, features/trees/tree-view/tree-view.component.ts   undo + new-person mode
frontend/public/assets/i18n/{en,de}.json                                    new keys
```

---

### Task 1: Soft-delete columns, query filters, migrations

**Files:**
- Create: `backend/src/Qseng.Domain/Common/ISoftDeletable.cs`
- Modify: `backend/src/Qseng.Domain/Entities/Person.cs`, `Relationship.cs`, `TimelineEvent.cs`, `Media.cs`; `backend/src/Qseng.Infrastructure/Persistence/QsengDbContext.cs`; `Configurations/{Person,Relationship,TimelineEvent,Media}Configuration.cs`
- Create: migrations under `Persistence/Migrations/Sqlite` and `Persistence/Migrations/Postgres`
- Test: `backend/tests/Qseng.Application.Tests/Trash/SoftDeleteTests.cs`

**Interfaces:**
- Produces: `ISoftDeletable { DateTime? DeletedAt; Guid? DeletionBatchId; }` implemented by the four entities; `IQsengDbContext` unchanged (filters live in the context).

- [ ] **Step 1: Failing test — filtered rows disappear from the DbSet**

`backend/tests/Qseng.Application.Tests/Trash/SoftDeleteTests.cs`:
```csharp
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Qseng.Domain.Entities;

namespace Qseng.Application.Tests.Trash;

public class SoftDeleteTests
{
    [Fact]
    public async Task Stamped_rows_are_hidden_by_the_query_filter_and_visible_with_IgnoreQueryFilters()
    {
        var db = TestDb.Create();
        var tree = new Tree { OwnerId = Guid.NewGuid(), Name = "T" };
        db.Trees.Add(tree);
        var live = new Person { TreeId = tree.Id, FirstName = "Live", LastName = "P" };
        var gone = new Person { TreeId = tree.Id, FirstName = "Gone", LastName = "P", DeletedAt = DateTime.UtcNow, DeletionBatchId = Guid.NewGuid() };
        db.Persons.AddRange(live, gone);
        await db.SaveChangesAsync();

        (await db.Persons.CountAsync()).Should().Be(1);
        (await db.Persons.IgnoreQueryFilters().CountAsync()).Should().Be(2);
    }
}
```
Run: `dotnet test /home/ben/repo/qseng/backend/tests/Qseng.Application.Tests --filter SoftDeleteTests`. Expected: compile error (`DeletedAt` missing).

- [ ] **Step 2: Domain**

`backend/src/Qseng.Domain/Common/ISoftDeletable.cs`:
```csharp
namespace Qseng.Domain.Common;

/// <summary>Rows are stamped instead of removed; a batch id groups the rows one delete stamped.</summary>
public interface ISoftDeletable
{
    DateTime? DeletedAt { get; set; }
    Guid? DeletionBatchId { get; set; }
}
```
Add to each of `Person`, `Relationship`, `TimelineEvent`, `Media` (all `: Entity`): implement `ISoftDeletable` and the two auto-properties
```csharp
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletionBatchId { get; set; }
```

- [ ] **Step 3: Query filters and indexes**

In `QsengDbContext.OnModelCreating`, after `ApplyConfigurationsFromAssembly`:
```csharp
        // Trash: one filter per soft-deletable type so no read path can forget it.
        // Handlers that need trashed rows call IgnoreQueryFilters() explicitly.
        b.Entity<Person>().HasQueryFilter(p => p.DeletedAt == null);
        b.Entity<Relationship>().HasQueryFilter(r => r.DeletedAt == null);
        b.Entity<TimelineEvent>().HasQueryFilter(e => e.DeletedAt == null);
        b.Entity<Media>().HasQueryFilter(m => m.DeletedAt == null);
```
In each of the four `*Configuration.cs` add `e.HasIndex(x => x.DeletedAt);`. Note: `FindAsync` on a tracked/keyed lookup does not apply query filters when the entity is already tracked; handlers below therefore use `FirstOrDefaultAsync` for trash-sensitive lookups.

- [ ] **Step 4: Migrations**

```bash
cd /home/ben/repo/qseng/backend/src/Qseng.Infrastructure   # if cd fails in your shell, pass --project/--startup-project absolute paths instead
dotnet ef migrations add AddSoftDelete --context SqliteQsengDbContext -o Persistence/Migrations/Sqlite --startup-project ../Qseng.Api
dotnet ef migrations add AddSoftDelete --context PostgresQsengDbContext -o Persistence/Migrations/Postgres --startup-project ../Qseng.Api
```
Expected: two migration files (+ designer) adding `DeletedAt`, `DeletionBatchId` and the four indexes; the two `*ModelSnapshot.cs` updated. Inspect the `Up()` bodies: only those columns/indexes, nothing else (if the snapshot shows unrelated drift, stop and report it).

- [ ] **Step 5: Run the test, the full backend suite, and boot check**

```bash
dotnet test /home/ben/repo/qseng/backend/Qseng.slnx
ASPNETCORE_ENVIRONMENT=Development timeout 60 dotnet run --project /home/ben/repo/qseng/backend/src/Qseng.Api --no-launch-profile --urls http://localhost:5000 2>&1 | grep -E "Now listening|Applying migration|error" | head -5
```
Expected: suite green (70 + 1); the app applies `AddSoftDelete` on boot and listens (the `timeout` kills it afterwards; exit code 124 is fine).

- [ ] **Step 6: Commit**

```bash
git -C /home/ben/repo/qseng add backend/src backend/tests/Qseng.Application.Tests/Trash/SoftDeleteTests.cs
git -C /home/ben/repo/qseng commit -m "feat(backend): soft-delete columns and global query filters for persons, relationships, events and media"
```

---

### Task 2: Delete handlers stamp instead of remove

**Files:**
- Modify: `backend/src/Qseng.Application/Persons/DeletePerson/DeletePersonCommand.cs`, `Relationships/DeleteRelationship/DeleteRelationshipCommand.cs`, `Timeline/DeleteTimelineEvent/DeleteTimelineEventCommand.cs`, `Media/DeleteMedia/DeleteMediaCommand.cs`
- Test: `backend/tests/Qseng.Application.Tests/Trash/SoftDeleteTests.cs` (extend), existing `Persons/PersonOwnershipTests.cs` keeps passing

**Interfaces:**
- Produces: `DeletePersonHandler` stamps person + relationships (`FromPersonId == id || ToPersonId == id`) + their auto-generated events + the person's events + media with one `DeletionBatchId`; `DeleteRelationshipHandler` stamps the relationship + its auto-generated events; `DeleteTimelineEventHandler` / `DeleteMediaHandler` stamp one row (media keeps the file; avatar promotion stays).

- [ ] **Step 1: Failing tests**

Append to `SoftDeleteTests`:
```csharp
    private static ICurrentUser FakeUser(Guid id) { var u = Substitute.For<ICurrentUser>(); u.UserId.Returns(id); return u; }

    private static async Task<(IQsengDbContext db, Guid owner, Person a, Person b, Relationship rel, TimelineEvent ev, Media media)> SeedFamilyAsync()
    {
        var db = TestDb.Create();
        var owner = Guid.NewGuid();
        var tree = new Tree { OwnerId = owner, Name = "T" };
        db.Trees.Add(tree);
        var a = new Person { TreeId = tree.Id, FirstName = "A", LastName = "X" };
        var b = new Person { TreeId = tree.Id, FirstName = "B", LastName = "X" };
        db.Persons.AddRange(a, b);
        var rel = new Relationship { TreeId = tree.Id, FromPersonId = a.Id, ToPersonId = b.Id, Type = RelationshipType.Spouse };
        db.Relationships.Add(rel);
        var ev = new TimelineEvent { PersonId = a.Id, Type = TimelineEventType.Marriage, Title = "Wedding", IsAutoGenerated = true, SourceRelationshipId = rel.Id };
        db.TimelineEvents.Add(ev);
        var media = new Media { PersonId = a.Id, Url = "/u/a.jpg", Kind = MediaKind.Photo, IsAvatar = true };
        db.Media.Add(media);
        await db.SaveChangesAsync();
        return (db, owner, a, b, rel, ev, media);
    }

    [Fact]
    public async Task DeletePerson_stamps_person_relationships_events_and_media_with_one_batch()
    {
        var (db, owner, a, b, rel, ev, media) = await SeedFamilyAsync();
        var storage = Substitute.For<IFileStorage>();
        var result = await new DeletePersonHandler(db, FakeUser(owner), storage).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        await storage.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());

        var persons = await db.Persons.IgnoreQueryFilters().ToListAsync();
        var gone = persons.Single(p => p.Id == a.Id);
        gone.DeletedAt.Should().NotBeNull();
        gone.DeletionBatchId.Should().NotBeNull();
        persons.Single(p => p.Id == b.Id).DeletedAt.Should().BeNull();
        (await db.Relationships.IgnoreQueryFilters().SingleAsync(r => r.Id == rel.Id)).DeletionBatchId.Should().Be(gone.DeletionBatchId);
        (await db.TimelineEvents.IgnoreQueryFilters().SingleAsync(e => e.Id == ev.Id)).DeletionBatchId.Should().Be(gone.DeletionBatchId);
        (await db.Media.IgnoreQueryFilters().SingleAsync(m => m.Id == media.Id)).DeletionBatchId.Should().Be(gone.DeletionBatchId);
        (await db.Persons.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DeleteRelationship_stamps_relationship_and_its_auto_events_only()
    {
        var (db, owner, a, _, rel, ev, _) = await SeedFamilyAsync();
        var manual = new TimelineEvent { PersonId = a.Id, Type = TimelineEventType.Other, Title = "Manual" };
        db.TimelineEvents.Add(manual);
        await db.SaveChangesAsync();
        var result = await new DeleteRelationshipHandler(db, FakeUser(owner)).Handle(new DeleteRelationshipCommand(rel.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        (await db.Relationships.CountAsync()).Should().Be(0);
        (await db.TimelineEvents.IgnoreQueryFilters().SingleAsync(e => e.Id == ev.Id)).DeletedAt.Should().NotBeNull();
        (await db.TimelineEvents.SingleAsync(e => e.Id == manual.Id)).DeletedAt.Should().BeNull();
    }

    [Fact]
    public async Task DeleteMedia_keeps_the_file_and_promotes_the_next_photo()
    {
        var (db, owner, a, _, _, _, media) = await SeedFamilyAsync();
        var other = new Media { PersonId = a.Id, Url = "/u/b.jpg", Kind = MediaKind.Photo };
        db.Media.Add(other);
        await db.SaveChangesAsync();
        var storage = Substitute.For<IFileStorage>();
        var result = await new DeleteMediaHandler(db, FakeUser(owner), storage).Handle(new DeleteMediaCommand(a.Id, media.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        await storage.DidNotReceive().DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        (await db.Media.SingleAsync(m => m.Id == other.Id)).IsAvatar.Should().BeTrue();
        (await db.Media.IgnoreQueryFilters().SingleAsync(m => m.Id == media.Id)).IsAvatar.Should().BeFalse("the filtered unique avatar index must not see two avatars");
    }

    [Fact]
    public async Task Deleting_an_already_trashed_person_returns_404()
    {
        var (db, owner, a, _, _, _, _) = await SeedFamilyAsync();
        var h = new DeletePersonHandler(db, FakeUser(owner), Substitute.For<IFileStorage>());
        await h.Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        var again = await h.Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        again.StatusCode.Should().Be(404);
    }
```
Add the `using`s the file needs (`NSubstitute`, `Qseng.Application.Abstractions`, the four handler namespaces, `Qseng.Domain.Enums` or wherever `RelationshipType`/`TimelineEventType`/`MediaKind` live — check with grep). Run the filter: expected failures (rows still removed / storage called).

- [ ] **Step 2: DeletePersonHandler**

Replace the `Handle` body:
```csharp
    public async Task<Result<bool>> Handle(DeletePersonCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.FirstOrDefaultAsync(p => p.Id == cmd.Id, ct);
        if (person is null) return Result<bool>.NotFound("Person not found.");
        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<bool>.Fail("Forbidden.", 403);

        var now = DateTime.UtcNow;
        var batch = Guid.NewGuid();
        void Stamp(ISoftDeletable row) { row.DeletedAt = now; row.DeletionBatchId = batch; }

        Stamp(person);
        var rels = await _db.Relationships.Where(r => r.FromPersonId == cmd.Id || r.ToPersonId == cmd.Id).ToListAsync(ct);
        foreach (var r in rels) Stamp(r);
        var relIds = rels.Select(r => r.Id).ToList();
        var events = await _db.TimelineEvents
            .Where(e => e.PersonId == cmd.Id || (e.SourceRelationshipId != null && relIds.Contains(e.SourceRelationshipId.Value)))
            .ToListAsync(ct);
        foreach (var e in events) Stamp(e);
        foreach (var m in await _db.Media.Where(m => m.PersonId == cmd.Id).ToListAsync(ct)) Stamp(m);

        await _db.SaveChangesAsync(ct);
        return Result<bool>.Ok(true);
    }
```
Keep the `IFileStorage` constructor parameter (files are deleted by the purge, not here) and add the `using Qseng.Domain.Common;`.

- [ ] **Step 3: The other three handlers**

`DeleteRelationshipHandler.Handle`: lookup with `FirstOrDefaultAsync(r => r.Id == cmd.Id, ct)`; replace the two `Remove*` calls with stamping (`now`, `batch` as above) of `rel` and `autoEvents`.
`DeleteTimelineEventHandler.Handle`: lookup with `FirstOrDefaultAsync`; replace `Remove(ev)` with `ev.DeletedAt = DateTime.UtcNow; ev.DeletionBatchId = Guid.NewGuid();`.
`DeleteMediaHandler.Handle`: lookup with `FirstOrDefaultAsync(m => m.Id == cmd.MediaId, ct)`; drop the `_fileStorage.DeleteAsync` call (keep the field; the purge deletes files); replace `Remove(media)` with stamping AND `media.IsAvatar = false;` before promoting the replacement (the filtered unique index counts trashed rows).

- [ ] **Step 4: Suite, commit**

```bash
dotnet test /home/ben/repo/qseng/backend/Qseng.slnx
git -C /home/ben/repo/qseng add backend/src/Qseng.Application backend/tests/Qseng.Application.Tests/Trash
git -C /home/ben/repo/qseng commit -m "feat(backend): delete handlers move rows to the trash instead of removing them"
```

---

### Task 3: Restore handlers, endpoints, regenerated client

**Files:**
- Create: `backend/src/Qseng.Application/Persons/RestorePerson/RestorePersonCommand.cs`, `Relationships/RestoreRelationship/RestoreRelationshipCommand.cs`, `Timeline/RestoreTimelineEvent/RestoreTimelineEventCommand.cs`, `Media/RestoreMedia/RestoreMediaCommand.cs`
- Modify: `backend/src/Qseng.Api/Controllers/{Persons,Relationships,Timeline,Media}Controller.cs`
- Test: `backend/tests/Qseng.Application.Tests/Trash/RestoreTests.cs`
- Regenerate: `contracts/openapi.json`, `frontend/src/app/core/api/generated/**` (gitignored) via `npm run gen`

**Interfaces:**
- Produces: `RestorePersonCommand(Guid Id) : IRequest<Result<PersonDto>>`, `RestoreRelationshipCommand(Guid TreeId, Guid Id) : IRequest<Result<RelationshipDto>>`, `RestoreTimelineEventCommand(Guid PersonId, Guid Id) : IRequest<Result<TimelineEventDto>>`, `RestoreMediaCommand(Guid PersonId, Guid MediaId) : IRequest<Result<MediaDto>>`; endpoints per spec §2; generated methods `personsRestore({ id })`, `relationshipsRestore({ treeId, id })`, `timelineRestore({ personId, id })`, `mediaRestore({ personId, mediaId })`.

- [ ] **Step 1: Failing tests**

`backend/tests/Qseng.Application.Tests/Trash/RestoreTests.cs` (reuse a copy of `SeedFamilyAsync` and `FakeUser` from Task 2 — move both into an `internal static class TrashFixtures` in the same folder and update `SoftDeleteTests` to use it):
```csharp
public class RestoreTests
{
    [Fact]
    public async Task RestorePerson_revives_only_its_batch()
    {
        var (db, owner, a, b, rel, ev, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        // an unrelated earlier delete: a second media row trashed on its own
        var old = new Media { PersonId = a.Id, Url = "/u/old.jpg", Kind = MediaKind.Document, DeletedAt = DateTime.UtcNow.AddDays(-3), DeletionBatchId = Guid.NewGuid() };
        db.Media.Add(old); await db.SaveChangesAsync();
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);

        var result = await new RestorePersonHandler(db, user).Handle(new RestorePersonCommand(a.Id), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Id.Should().Be(a.Id);
        (await db.Persons.CountAsync()).Should().Be(2);
        (await db.Relationships.CountAsync()).Should().Be(1);
        (await db.TimelineEvents.CountAsync()).Should().Be(1);
        (await db.Media.CountAsync()).Should().Be(1, "the media trashed in an earlier batch stays in the trash");
        (await db.Media.SingleAsync()).IsAvatar.Should().BeTrue("avatar flag restored with the batch");
    }

    [Fact]
    public async Task RestoreRelationship_of_a_trashed_person_returns_409()
    {
        var (db, owner, a, _, rel, _, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        var result = await new RestoreRelationshipHandler(db, user).Handle(new RestoreRelationshipCommand(rel.TreeId, rel.Id), CancellationToken.None);
        result.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Restore_live_or_unknown_row_returns_404_and_non_owner_403()
    {
        var (db, owner, a, _, _, ev, _) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        (await new RestoreTimelineEventHandler(db, user).Handle(new RestoreTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).StatusCode.Should().Be(404);
        (await new RestoreTimelineEventHandler(db, user).Handle(new RestoreTimelineEventCommand(a.Id, Guid.NewGuid()), CancellationToken.None)).StatusCode.Should().Be(404);
        await new DeleteTimelineEventHandler(db, user).Handle(new DeleteTimelineEventCommand(ev.Id), CancellationToken.None);
        (await new RestoreTimelineEventHandler(db, TrashFixtures.FakeUser(Guid.NewGuid())).Handle(new RestoreTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).StatusCode.Should().Be(403);
        (await new RestoreTimelineEventHandler(db, user).Handle(new RestoreTimelineEventCommand(a.Id, ev.Id), CancellationToken.None)).IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RestoreMedia_revives_the_row_without_reclaiming_the_avatar()
    {
        var (db, owner, a, _, _, _, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        var other = new Media { PersonId = a.Id, Url = "/u/b.jpg", Kind = MediaKind.Photo };
        db.Media.Add(other); await db.SaveChangesAsync();
        await new DeleteMediaHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeleteMediaCommand(a.Id, media.Id), CancellationToken.None);
        var result = await new RestoreMediaHandler(db, user).Handle(new RestoreMediaCommand(a.Id, media.Id), CancellationToken.None);
        result.IsSuccess.Should().BeTrue();
        (await db.Media.CountAsync(m => m.IsAvatar)).Should().Be(1, "the promoted photo keeps the avatar");
    }
}
```

- [ ] **Step 2: Handlers**

`RestorePersonCommand.cs`:
```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using Qseng.Application.Abstractions;
using Qseng.Application.Common;
using Qseng.Application.Persons.CreatePerson;
using Qseng.Domain.Common;

namespace Qseng.Application.Persons.RestorePerson;

public record RestorePersonCommand(Guid Id) : IRequest<Result<PersonDto>>;

public class RestorePersonHandler : IRequestHandler<RestorePersonCommand, Result<PersonDto>>
{
    private readonly IQsengDbContext _db;
    private readonly ICurrentUser _currentUser;
    public RestorePersonHandler(IQsengDbContext db, ICurrentUser currentUser) { _db = db; _currentUser = currentUser; }

    public async Task<Result<PersonDto>> Handle(RestorePersonCommand cmd, CancellationToken ct)
    {
        var person = await _db.Persons.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == cmd.Id && p.DeletedAt != null, ct);
        if (person is null) return Result<PersonDto>.NotFound("Person not found in the trash.");
        var tree = await _db.Trees.FindAsync([person.TreeId], ct);
        if (tree is null || tree.OwnerId != _currentUser.UserId) return Result<PersonDto>.Fail("Forbidden.", 403);

        var batch = person.DeletionBatchId;
        static void Revive(ISoftDeletable row) { row.DeletedAt = null; row.DeletionBatchId = null; }
        Revive(person);
        if (batch is not null)
        {
            foreach (var r in await _db.Relationships.IgnoreQueryFilters().Where(r => r.DeletionBatchId == batch).ToListAsync(ct)) Revive(r);
            foreach (var e in await _db.TimelineEvents.IgnoreQueryFilters().Where(e => e.DeletionBatchId == batch).ToListAsync(ct)) Revive(e);
            foreach (var m in await _db.Media.IgnoreQueryFilters().Where(m => m.DeletionBatchId == batch).ToListAsync(ct)) Revive(m);
        }
        await _db.SaveChangesAsync(ct);
        var avatar = await _db.Media.Where(m => m.PersonId == person.Id && m.IsAvatar).Select(m => m.Url).FirstOrDefaultAsync(ct);
        return Result<PersonDto>.Ok(CreatePersonHandler.ToDto(person, avatar));
    }
}
```
(`ToDto` is `internal static` on the create handler class — check its exact declaring class name and the avatar-url convention used by `GetPersonByIdQuery`, and mirror it.) The restored avatar flag: `DeletePersonHandler` never cleared `IsAvatar` on the person's media, so it comes back as-is. But `DeleteMediaHandler` did clear it — hence the 409/avatar rules below.

`RestoreRelationshipCommand.cs` (`RestoreRelationshipCommand(Guid TreeId, Guid Id)`): find with `IgnoreQueryFilters()` and `r.Id == cmd.Id && r.TreeId == cmd.TreeId && r.DeletedAt != null` → 404; owner check → 403; if either `FromPersonId`/`ToPersonId` person is not live (`!await _db.Persons.AnyAsync(p => p.Id == id, ct)`) → `Result<RelationshipDto>.Conflict("Restore the person first.")`; revive the relationship and the auto-generated events sharing its `DeletionBatchId`; return `CreateRelationshipHandler.ToDto(rel)` (check the declaring class).

`RestoreTimelineEventCommand.cs` (`(Guid PersonId, Guid Id)`): `IgnoreQueryFilters` lookup by id + `PersonId == cmd.PersonId` + trashed → 404; the person must be live (`_db.Persons.FirstOrDefaultAsync`) else 409; owner via the person's tree → 403; revive; return `AddTimelineEventHandler.ToDto(ev)`.

`RestoreMediaCommand.cs` (`(Guid PersonId, Guid MediaId)`): same shape; revive with `IsAvatar` left `false` (restoring never steals the avatar); return a `MediaDto` built the same way `UploadMediaCommand` builds it.

- [ ] **Step 3: Controllers**

`PersonsController`: 
```csharp
    [HttpPost("persons/{id:guid}/restore")]
    [ProducesResponseType(typeof(PersonDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct) =>
        (await _mediator.Send(new RestorePersonCommand(id), ct)).ToActionResult();
```
`RelationshipsController`: `[HttpPost("{id:guid}/restore")]` → `RestoreRelationshipCommand(treeId, id)`, add `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]`.
`TimelineController`: `[HttpPost("{id:guid}/restore")]` → `RestoreTimelineEventCommand(personId, id)` (+409).
`MediaController`: `[HttpPost("persons/{personId:guid}/media/{mediaId:guid}/restore")]` → `RestoreMediaCommand(personId, mediaId)`.
(Global filters in `Program.cs` already add 400/401/403/500; mirror whatever the neighbouring actions declare.)

- [ ] **Step 4: Tests, contract, client**

```bash
dotnet test /home/ben/repo/qseng/backend/Qseng.slnx
bash /home/ben/repo/qseng/backend/export-openapi.sh
node -e "const s=require('/home/ben/repo/qseng/contracts/openapi.json');console.log(Object.values(s.paths).flatMap(p=>Object.values(p)).map(o=>o.operationId).filter(x=>/Restore/.test(x)).join(', '))"
npm run gen --prefix /home/ben/repo/qseng/frontend
grep -c "Restore" /home/ben/repo/qseng/frontend/src/app/core/api/generated/services/persons-api.ts
```
Expected: `Persons_Restore, Relationships_Restore, Timeline_Restore, Media_Restore`; the generated `PersonsApi` has `personsRestore`. Then `npx --prefix /home/ben/repo/qseng/frontend ng build` still succeeds.

- [ ] **Step 5: Commit**

```bash
git -C /home/ben/repo/qseng add backend/src backend/tests contracts/openapi.json
git -C /home/ben/repo/qseng commit -m "feat(api): restore endpoints for trashed persons, relationships, events and media"
```

---

### Task 4: Trash purge

**Files:**
- Create: `backend/src/Qseng.Application/Trash/TrashOptions.cs`, `backend/src/Qseng.Application/Trash/TrashPurger.cs`, `backend/src/Qseng.Infrastructure/Trash/TrashPurgeService.cs`
- Modify: `backend/src/Qseng.Infrastructure/DependencyInjection.cs` (register options, `TimeProvider.System`, `TrashPurger`, hosted service), `backend/src/Qseng.Api/appsettings.json` (`"Trash": { "RetentionDays": 30 }`), `backend/src/Qseng.Application/User/DeleteData/*.cs` + `DeleteAccount/*.cs` (verify they still remove trashed rows — see Step 3)
- Test: `backend/tests/Qseng.Application.Tests/Trash/TrashPurgerTests.cs`

**Interfaces:**
- Produces: `TrashOptions { int RetentionDays = 30 }` (section `Trash`); `TrashPurger.PurgeAsync(DateTime cutoffUtc, CancellationToken) → Task<int>` (rows removed); `TrashPurgeService : BackgroundService` running `PurgeAsync(now - RetentionDays)` at start and every 24 h.

- [ ] **Step 1: Failing test**

```csharp
public class TrashPurgerTests
{
    [Fact]
    public async Task Purge_removes_rows_older_than_the_cutoff_and_their_files_only()
    {
        var (db, owner, a, b, rel, ev, media) = await TrashFixtures.SeedFamilyAsync();
        var user = TrashFixtures.FakeUser(owner);
        await new DeletePersonHandler(db, user, Substitute.For<IFileStorage>()).Handle(new DeletePersonCommand(a.Id), CancellationToken.None);
        // age the batch by 40 days
        foreach (var row in await db.Persons.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        foreach (var row in await db.Relationships.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        foreach (var row in await db.TimelineEvents.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        foreach (var row in await db.Media.IgnoreQueryFilters().Where(p => p.DeletedAt != null).ToListAsync()) row.DeletedAt = DateTime.UtcNow.AddDays(-40);
        var recent = new Media { PersonId = b.Id, Url = "/u/recent.jpg", Kind = MediaKind.Photo, DeletedAt = DateTime.UtcNow.AddDays(-1), DeletionBatchId = Guid.NewGuid() };
        db.Media.Add(recent);
        await db.SaveChangesAsync();
        var storage = Substitute.For<IFileStorage>();

        var removed = await new TrashPurger(db, storage, NullLogger<TrashPurger>.Instance).PurgeAsync(DateTime.UtcNow.AddDays(-30), CancellationToken.None);

        removed.Should().Be(4);
        await storage.Received(1).DeleteAsync("/u/a.jpg", Arg.Any<CancellationToken>());
        await storage.DidNotReceive().DeleteAsync("/u/recent.jpg", Arg.Any<CancellationToken>());
        (await db.Persons.IgnoreQueryFilters().CountAsync()).Should().Be(1);
        (await db.Media.IgnoreQueryFilters().CountAsync()).Should().Be(1);
    }
}
```

- [ ] **Step 2: Implementation**

`TrashOptions.cs`:
```csharp
namespace Qseng.Application.Trash;
public class TrashOptions { public const string SectionName = "Trash"; public int RetentionDays { get; set; } = 30; }
```
`TrashPurger.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Qseng.Application.Abstractions;

namespace Qseng.Application.Trash;

/// <summary>Hard-deletes trashed rows older than a cutoff. Media files are removed first so a crash leaves orphans, never dangling rows.</summary>
public class TrashPurger
{
    private readonly IQsengDbContext _db;
    private readonly IFileStorage _files;
    private readonly ILogger<TrashPurger> _log;
    public TrashPurger(IQsengDbContext db, IFileStorage files, ILogger<TrashPurger> log) { _db = db; _files = files; _log = log; }

    public async Task<int> PurgeAsync(DateTime cutoffUtc, CancellationToken ct)
    {
        var media = await _db.Media.IgnoreQueryFilters().Where(m => m.DeletedAt != null && m.DeletedAt < cutoffUtc).ToListAsync(ct);
        foreach (var m in media)
        {
            try { await _files.DeleteAsync(m.Url, ct); }
            catch (Exception ex) { _log.LogWarning(ex, "Could not delete media file {Url}", m.Url); }
        }
        var events = await _db.TimelineEvents.IgnoreQueryFilters().Where(e => e.DeletedAt != null && e.DeletedAt < cutoffUtc).ToListAsync(ct);
        var rels = await _db.Relationships.IgnoreQueryFilters().Where(r => r.DeletedAt != null && r.DeletedAt < cutoffUtc).ToListAsync(ct);
        var persons = await _db.Persons.IgnoreQueryFilters().Where(p => p.DeletedAt != null && p.DeletedAt < cutoffUtc).ToListAsync(ct);
        _db.Media.RemoveRange(media);
        _db.TimelineEvents.RemoveRange(events);
        _db.Relationships.RemoveRange(rels);
        _db.Persons.RemoveRange(persons);
        await _db.SaveChangesAsync(ct);
        var n = media.Count + events.Count + rels.Count + persons.Count;
        _log.LogInformation("Trash purge removed {Count} rows older than {Cutoff:u}", n, cutoffUtc);
        return n;
    }
}
```
`TrashPurgeService.cs` (Infrastructure):
```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Qseng.Application.Trash;

namespace Qseng.Infrastructure.Trash;

public class TrashPurgeService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private readonly IServiceScopeFactory _scopes;
    private readonly IOptions<TrashOptions> _options;
    private readonly TimeProvider _clock;
    private readonly ILogger<TrashPurgeService> _log;
    public TrashPurgeService(IServiceScopeFactory scopes, IOptions<TrashOptions> options, TimeProvider clock, ILogger<TrashPurgeService> log)
    { _scopes = scopes; _options = options; _clock = clock; _log = log; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var purger = scope.ServiceProvider.GetRequiredService<TrashPurger>();
                var cutoff = _clock.GetUtcNow().UtcDateTime.AddDays(-_options.Value.RetentionDays);
                await purger.PurgeAsync(cutoff, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { _log.LogError(ex, "Trash purge failed"); }
            try { await Task.Delay(Interval, _clock, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }
}
```
`DependencyInjection.AddInfrastructure`: add
```csharp
        services.AddOptions<TrashOptions>().Bind(cfg.GetSection(TrashOptions.SectionName));
        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<TrashPurger>();
        services.AddHostedService<TrashPurgeService>();
```
(`using Microsoft.Extensions.DependencyInjection.Extensions;` for `TryAddSingleton`.) `appsettings.json`: `"Trash": { "RetentionDays": 30 }`.

- [ ] **Step 3: DeleteData / DeleteAccount still remove trash**

Read `backend/src/Qseng.Application/User/DeleteData` and `DeleteAccount` handlers. If they delete trees and rely on the database cascade, trashed persons go with the tree (cascade is by FK, not by query) — verify by adding to `TrashPurgerTests`:
```csharp
    [Fact]
    public async Task DeleteData_removes_trashed_rows_too() { /* seed, trash a person, run the DeleteData handler for the owner, assert Persons.IgnoreQueryFilters().Count() == 0 */ }
```
If the handler removes persons through the filtered `DbSet` (e.g. `_db.Persons.Where(...)`), change those queries to `IgnoreQueryFilters()`. The in-memory provider does not cascade — seed explicitly and assert on what the handler touches directly; note in the report which path applies.

- [ ] **Step 4: Suite, boot log, commit**

```bash
dotnet test /home/ben/repo/qseng/backend/Qseng.slnx
ASPNETCORE_ENVIRONMENT=Development timeout 40 dotnet run --project /home/ben/repo/qseng/backend/src/Qseng.Api --no-launch-profile --urls http://localhost:5000 2>&1 | grep -E "Trash purge|Now listening|error" | head -3
git -C /home/ben/repo/qseng add backend/src backend/tests
git -C /home/ben/repo/qseng commit -m "feat(backend): daily trash purge with configurable retention"
```
Expected boot log: one `Trash purge removed 0 rows …` line.

---

### Task 5: Undo toast and rewired delete call sites

**Files:**
- Modify: `frontend/src/app/core/ui/toast.service.ts`, create `toast.service.spec.ts`
- Modify: `frontend/src/app/features/persons/person-family.component.ts` (+ spec), `features/timeline/timeline.component.ts` (+ spec), `features/persons/person-media.component.ts` (+ spec), `features/trees/tree-view/tree-view.component.ts` (+ spec)
- Modify: `frontend/public/assets/i18n/en.json`, `de.json`; run `npm run gen:i18n`

**Interfaces:**
- Produces: `ToastService.undoable(message: string, onUndo: () => void | Promise<void>, durationMs = 6000): void`.
- Consumes: `personsRestore`, `relationshipsRestore`, `timelineRestore`, `mediaRestore` from the generated client (Task 3).

- [ ] **Step 1: i18n keys**

en / de:
```
"undo": "Undo" / "Rückgängig"
"err.restore": "Could not restore." / "Konnte nicht wiederhergestellt werden."
"fam.removed.undo": "Relationship removed." / "Beziehung entfernt."
"tl.deleted.undo": "Event deleted." / "Ereignis gelöscht."
"media.deleted.undo": "File deleted." / "Datei gelöscht."
"tree.deleted.undo": "__NAME__ deleted." / "__NAME__ gelöscht."
"restored.toast": "Restored." / "Wiederhergestellt."
```
Remove `rel.removed.toast`, `tl.deleted.toast`, `media.deleted.toast`, `tree.deleted.toast`, `fam.removeConfirm`, `tl.deleteTitle`, `tl.deleteConfirm`, `media.deleteTitle`, `media.deleteConfirm` once no longer referenced (the gates script reports leftovers). Keep `pe.deleteTitle`/`pe.deleteConfirm` (person delete keeps its confirm).

- [ ] **Step 2: Failing spec for `undoable`**

`frontend/src/app/core/ui/toast.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';
import { I18nService } from '../i18n/i18n.service';

describe('ToastService.undoable', () => {
  function setup() {
    TestBed.resetTestingModule();
    const action$ = new Subject<void>();
    const ref = { onAction: () => action$.asObservable(), dismiss: vi.fn() };
    const snack = { open: vi.fn(() => ref) };
    TestBed.configureTestingModule({ providers: [
      { provide: MatSnackBar, useValue: snack },
      { provide: I18nService, useValue: { t: (k: string) => k, dynamic: (k: string) => k } }
    ] });
    return { svc: TestBed.inject(ToastService), snack, action$ };
  }

  it('opens a snackbar with the translated Undo action and runs onUndo when clicked', async () => {
    const { svc, snack, action$ } = setup();
    const onUndo = vi.fn(async () => undefined);
    svc.undoable('Deleted.', onUndo);
    expect(snack.open).toHaveBeenCalledWith('Deleted.', 'undo', expect.objectContaining({ duration: 6000, politeness: 'polite' }));
    action$.next();
    await Promise.resolve();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('reports a failing onUndo through the error toast', async () => {
    const { svc, snack, action$ } = setup();
    svc.undoable('Deleted.', async () => { throw new Error('boom'); });
    action$.next();
    await new Promise(r => setTimeout(r, 0));
    const calls = (snack.open as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[calls.length - 1][0]).toBe('err.restore');
  });
});
```

- [ ] **Step 3: Implement**

In `toast.service.ts` inject `I18nService` and add:
```ts
  /** "Deleted · Undo": runs `onUndo` when the action is clicked; a failing undo is reported once. */
  undoable(message: string, onUndo: () => void | Promise<void>, durationMs = 6000) {
    const ref = this.snack.open(message, this.i18n.t('undo'), { panelClass: 'qs-toast-info', duration: durationMs, politeness: 'polite' });
    ref.onAction().subscribe(() => {
      Promise.resolve().then(onUndo).catch(err => this.errorFrom(err, this.i18n.t('err.restore')));
    });
  }
```
Run the spec → green. Check `ToastService`'s existing consumers still compile (constructor injection unchanged).

- [ ] **Step 4: Call sites**

`person-family.component.ts` `remove(r)`: delete the confirm (drop the `ConfirmDialogService` inject if unused), then
```ts
    const id = r.relationshipId;
    this.api.relationshipsDelete({ treeId, id }).subscribe({
      next: () => {
        this.store.reloadRelations(); this.store.reloadTimeline();
        this.toast.undoable(this.i18n.t('fam.removed.undo'), () => firstValueFrom(this.api.relationshipsRestore({ treeId, id })).then(() => { this.store.reloadRelations(); this.store.reloadTimeline(); }));
      },
      error: e => this.toast.errorFrom(e, this.i18n.t('err.delete'))
    });
```
`timeline.component.ts` delete: drop the confirm; on success `this.store.removeEvent(id)` then `undoable('tl.deleted.undo', () => firstValueFrom(this.api.timelineRestore({ personId, id })).then(() => this.store.reloadTimeline()))`.
`person-media.component.ts` delete: drop the confirm; on success as today (`removeMedia`, `reloadMedia` if avatar) then `undoable('media.deleted.undo', () => firstValueFrom(this.api.mediaRestore({ personId, mediaId })).then(() => this.store.reloadMedia()))`.
`tree-view.component.ts` `deletePerson`: keep the confirm; on success `this.store.reload()` and `undoable(this.i18n.t('tree.deleted.undo').replace('__NAME__', name), () => firstValueFrom(this.personsApi.personsRestore({ id: person.id! })).then(() => { this.store.reload(); this.onSelected(person.id!); }))` (keep the `destroyed` guard; the undo callback must still run if the component was destroyed — it only touches the API and a possibly-dead store, which is harmless).
Update the four specs: the confirm mock is gone for three of them; assert `toast.undoable` is called with the right key and that invoking the captured `onUndo` calls the restore API and the reload.

- [ ] **Step 5: Gates, suite, build, commit**

```bash
npm run gen:i18n --prefix /home/ben/repo/qseng/frontend && npm run gates --prefix /home/ben/repo/qseng/frontend
timeout 300 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false
npx --prefix /home/ben/repo/qseng/frontend ng lint && npx --prefix /home/ben/repo/qseng/frontend ng build 2>&1 | grep -E "Initial total|WARNING|ERROR"
git -C /home/ben/repo/qseng add frontend/src frontend/public/assets/i18n
git -C /home/ben/repo/qseng commit -m "feat(ui): undo toast for deleted relationships, events, media and persons"
```

---

### Task 6: Relationship dialog "New person" mode

**Files:**
- Modify: `frontend/src/app/features/persons/relationship-dialog.component.ts` (+ spec), callers: `features/persons/person-family.component.ts`, `features/trees/tree-view/tree-view.component.ts`
- Modify: i18n (both), `gen:i18n`

**Interfaces:**
- Produces: dialog result type `RelationshipDialogResult = { relationship: RelationshipDto; created?: PersonDto }` (exported); `RelationshipDialogData` gains `mode?: 'existing' | 'new'` (preselect).
- Consumes: `PersonsApi.personsCreate({ treeId, body: PersonRequest })`, `personsDelete({ id })`.

- [ ] **Step 1: i18n**

```
"rel.mode.existing": "Existing person" / "Vorhandene Person"
"rel.mode.new": "New person" / "Neue Person"
"rel.new.firstName": "First name" / "Vorname"
"rel.new.lastName": "Last name" / "Nachname"
"rel.new.sex": "Sex" / "Geschlecht"
"rel.new.birthPlace": "Birth place" / "Geburtsort"
"rel.added.parent": "__NAME__ added as parent." / "__NAME__ als Elternteil hinzugefügt."
"rel.added.child": "__NAME__ added as child." / "__NAME__ als Kind hinzugefügt."
"rel.added.spouse": "__NAME__ added as spouse." / "__NAME__ als Partner hinzugefügt."
"rel.added.adoptive": "__NAME__ added as adoptive parent." / "__NAME__ als Adoptivelternteil hinzugefügt."
"rel.open": "Open" / "Öffnen"
```

- [ ] **Step 2: Failing spec cases** (extend `relationship-dialog.component.spec.ts`; follow its existing `setup()` pattern, adding a `PersonsApi` stub `{ personsCreate: vi.fn(), personsDelete: vi.fn(() => of(true)) }`):
```ts
  it('new-person mode creates the person, links it and closes with both', async () => {
    const { fixture, ref, persons, rels } = setup({ anchor: people[0], presetType: 'Child', mode: 'new' });
    const c = fixture.componentInstance;
    persons.personsCreate.mockReturnValue(of({ id: 'n1', firstName: 'Anna', lastName: 'Smith', treeId: 't1' }));
    rels.relationshipsCreate.mockReturnValue(of({ id: 'r1' }));
    c.newForm.patchValue({ firstName: 'Anna' });
    c.save();
    await fixture.whenStable();
    expect(persons.personsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ firstName: 'Anna', lastName: 'Smith' }) });
    expect(rels.relationshipsCreate).toHaveBeenCalledWith({ treeId: 't1', body: expect.objectContaining({ fromPersonId: 'p1', toPersonId: 'n1', type: 'Parent' }) });
    expect(ref.close).toHaveBeenCalledWith({ relationship: { id: 'r1' }, created: expect.objectContaining({ id: 'n1' }) });
  });

  it('rolls the created person back when linking fails and stays open', async () => {
    const { fixture, ref, persons, rels } = setup({ anchor: people[0], presetType: 'Spouse', mode: 'new' });
    const c = fixture.componentInstance;
    persons.personsCreate.mockReturnValue(of({ id: 'n1', firstName: 'Anna', lastName: 'Ray', treeId: 't1' }));
    rels.relationshipsCreate.mockReturnValue(throwError(() => ({ status: 409, error: { title: 'Conflict', detail: 'Already spouses.', status: 409 } })));
    c.newForm.patchValue({ firstName: 'Anna', lastName: 'Ray' });
    c.save();
    await fixture.whenStable();
    expect(persons.personsDelete).toHaveBeenCalledWith({ id: 'n1' });
    expect(ref.close).not.toHaveBeenCalled();
    expect(c.error()).toContain('Already spouses.');
  });

  it('new-person mode requires first and last name', () => {
    const { fixture, persons } = setup({ anchor: people[0], presetType: 'Child', mode: 'new' });
    fixture.componentInstance.save();
    expect(persons.personsCreate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.newForm.controls.firstName.touched).toBe(true);
  });
```
(`people[0]` = `{ id: 'p1', firstName: 'Konrad', lastName: 'Smith', treeId: 't1' }`; `Child` preset with anchor p1 means p1 is the parent → `toApiRelationship('Child', roleHolder=new, counterpart=anchor)` — assert whatever the existing helper produces: check `toApiRelationship`'s mapping in `tree-graph.model.ts` and adjust the expected `fromPersonId/toPersonId/type` accordingly rather than guessing.)

- [ ] **Step 3: Implement**

In `relationship-dialog.component.ts`:
- `RelationshipDialogData.mode?: 'existing' | 'new'`; export `interface RelationshipDialogResult { relationship: RelationshipDto; created?: PersonDto }`; `MatDialogRef<RelationshipDialogComponent, RelationshipDialogResult | undefined>`.
- `readonly mode = signal<'existing' | 'new'>(this.data.mode ?? (sessionStorage.getItem('qs.relMode') === 'new' ? 'new' : 'existing'))` (guard `sessionStorage` access in try/catch); `setMode(m)` persists it.
- Template: under the type field, `@if (data.anchor) { <mat-button-toggle-group hideSingleSelectionIndicator [value]="mode()" (change)="setMode($event.value)" [attr.aria-label]="'rel.mode.new' | translate"><mat-button-toggle value="existing">{{ 'rel.mode.existing' | translate }}</mat-button-toggle><mat-button-toggle value="new">{{ 'rel.mode.new' | translate }}</mat-button-toggle></mat-button-toggle-group> }`; the person autocomplete field renders only when `mode() === 'existing' || !data.anchor`; when `mode() === 'new' && data.anchor` render:
```html
          <div class="qs-dialog-form" [formGroup]="newForm">
            <mat-form-field><mat-label>{{ 'rel.new.firstName' | translate }}</mat-label><input matInput formControlName="firstName" maxlength="200" cdkFocusInitial><mat-error>{{ newForm.controls.firstName.errors | formErrors }}</mat-error></mat-form-field>
            <mat-form-field><mat-label>{{ 'rel.new.lastName' | translate }}</mat-label><input matInput formControlName="lastName" maxlength="200"><mat-error>{{ newForm.controls.lastName.errors | formErrors }}</mat-error></mat-form-field>
            <mat-button-toggle-group formControlName="sex" [attr.aria-label]="'rel.new.sex' | translate">
              @for (s of sexes; track s) { <mat-button-toggle [value]="s">{{ i18n.sexLabel(s) }}</mat-button-toggle> }
            </mat-button-toggle-group>
            <qs-partial-date-input formControlName="birth" [label]="'pd.birth' | translate" />
            <mat-form-field><mat-label>{{ 'rel.new.birthPlace' | translate }}</mat-label><input matInput formControlName="birthPlace" maxlength="200"></mat-form-field>
          </div>
```
(`sexes: Sex[] = ['Male', 'Female', 'Unknown']` — use the generated `Sex` union; `i18n.sexLabel` exists.)
- `newForm = fb.nonNullable.group({ firstName: ['', Validators.required], lastName: [prefill, Validators.required], sex: ['Unknown' as Sex], birth: [null as PartialDate | null], birthPlace: [''] })` where `prefill = this.data.presetType === 'Spouse' ? '' : (this.data.anchor?.lastName ?? '')`.
- `save()`: if `mode() === 'new' && data.anchor`: `if (this.newForm.invalid) { this.newForm.markAllAsTouched(); return; }`; build `body: PersonRequest` from `newForm` (`maidenName: null, notes: null, death: null, deathPlace: null, causeOfDeath: null`); `saving.set(true)`; `personsCreate({ treeId, body })` → on success `created`, then build the relationship exactly as the existing path does with `roleHolder = created`, `counterpart = anchor`, and call `relationshipsCreate`; on relationship failure: set the error (validation → `setServerErrors(this.form, …)`, else `problemMessage(e, i18n.t('tree.relErr'))` into `error()`), `saving.set(false)`, and fire-and-forget `personsDelete({ id: created.id! }).subscribe({ error: () => undefined })`; on success `ref.close({ relationship, created })`. The existing path closes with `{ relationship }`.
- Import `MatButtonToggleModule`, `PersonsApi`, `PersonRequest`, `Sex`, `problemMessage`, `firstValueFrom` if used.

- [ ] **Step 4: Callers**

`person-family.component.ts`: result is now `RelationshipDialogResult | undefined`; on result reload relations/timeline as today, and if `result.created` toast `rel.added.<type>` (lower-cased `result.relationship.type`, or the dialog's preset when the API type differs — use `this.i18n.dynamic('rel.added.' + presetType.toLowerCase())` with the preset the caller passed) with `{ action: this.i18n.t('rel.open'), onAction: () => this.router.navigate(['/persons', result.created!.id]) }`. Empty family groups: add an inline `<button matButton (click)="add('Parent')">` etc. per spec §5 ("fam.add.parent|spouse|child" keys: "Add parent" / "Elternteil hinzufügen", "Add spouse" / "Partner hinzufügen", "Add child" / "Kind hinzufügen") opening the dialog with `mode: 'new'`.
`tree-view.component.ts` `addRelationFor` / `addRelationFree`: on `result.created`, `store.reload()` then `onSelected(result.created.id!)` and the same toast with "Open".

- [ ] **Step 5: Gates, suite, build, commit**

```bash
npm run gen:i18n --prefix /home/ben/repo/qseng/frontend && npm run gates --prefix /home/ben/repo/qseng/frontend
timeout 300 npx --prefix /home/ben/repo/qseng/frontend ng test --watch=false
npx --prefix /home/ben/repo/qseng/frontend ng lint && npx --prefix /home/ben/repo/qseng/frontend ng build 2>&1 | grep -E "Initial total|WARNING|ERROR"
git -C /home/ben/repo/qseng add frontend/src frontend/public/assets/i18n
git -C /home/ben/repo/qseng commit -m "feat(persons): relationship dialog can create the related person inline, with rollback when linking fails"
```

---

### Task 7: Browser verification (controller-run)

- [ ] Start API + dev server (see P1e plan Task 6 Step 2). Log in as demo.
- [ ] Tree view: right-click a leaf person → Delete → confirm → toast "X deleted · Undo" → click Undo → the person and their edges are back and selected. Repeat and let the toast expire → reload the page → the person stays gone. Check `GET /api/v1/trees/{id}/persons` no longer lists them.
- [ ] Person page: remove a relationship chip → toast → Undo → chip back (and the auto marriage event back on the timeline). Delete a timeline event and a media item → Undo each.
- [ ] Add relative: context menu "Add child" → "New person" mode preselected? (default is Existing unless remembered) → switch to New → fill first name → Save → toast "… added as child · Open"; the new node is selected in the graph. Force a failure (e.g. add a spouse twice) and confirm the dialog stays open and the extra person is not left behind (people list count unchanged).
- [ ] Handset 400 px: same add-child flow through the selection bottom sheet.
- [ ] axe on the dialog in both modes (light/dark, 1400/400), screenshots to `docs/superpowers/specs/assets/p2/`; zero console errors.
- [ ] Record findings in the ledger; fix wave if needed; then whole-plan review (opus) and commit the screenshots (`docs(p2a): …`).

## Next plan

P2b: onboarding stepper, command palette, shortcut sheet (`2026-09-14-p2b-onboarding-palette.md`).
