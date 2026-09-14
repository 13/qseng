using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Qseng.Api.Controllers;
using Qseng.Application.Common;
using Qseng.Application.Persons;
using Qseng.Application.Persons.RestorePerson;
using Qseng.Domain.Enums;
using Xunit;

namespace Qseng.Api.Tests;

public class PersonsControllerRestoreTests
{
    [Fact]
    public async Task Restore_of_a_person_not_in_the_trash_returns_404_problem_details()
    {
        var mediator = Substitute.For<ISender>();
        var id = Guid.NewGuid();
        mediator.Send(Arg.Is<RestorePersonCommand>(c => c.Id == id), Arg.Any<CancellationToken>())
            .Returns(Result<PersonDto>.NotFound("Person not found in the trash."));
        var controller = new PersonsController(mediator);

        var action = await controller.Restore(id, CancellationToken.None);

        var obj = action.Should().BeOfType<ObjectResult>().Subject;
        obj.StatusCode.Should().Be(404);
        var problem = obj.Value.Should().BeOfType<ProblemDetails>().Subject;
        problem.Status.Should().Be(404);
        problem.Detail.Should().Be("Person not found in the trash.");
    }

    [Fact]
    public async Task Restore_of_a_trashed_person_returns_200_with_the_person()
    {
        var mediator = Substitute.For<ISender>();
        var id = Guid.NewGuid();
        var dto = new PersonDto(
            id, Guid.NewGuid(), "Anna", "Muster", null, Sex.Female, null,
            null, null, null, null, null,
            DateTime.UtcNow, DateTime.UtcNow);
        mediator.Send(Arg.Is<RestorePersonCommand>(c => c.Id == id), Arg.Any<CancellationToken>())
            .Returns(Result<PersonDto>.Ok(dto));
        var controller = new PersonsController(mediator);

        var action = await controller.Restore(id, CancellationToken.None);

        var ok = action.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(dto);
    }
}
