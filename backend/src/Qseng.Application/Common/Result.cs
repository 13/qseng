namespace Qseng.Application.Common;

public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }
    public int StatusCode { get; }

    private Result(T value) { IsSuccess = true; Value = value; StatusCode = 200; }
    private Result(string error, int statusCode) { IsSuccess = false; Error = error; StatusCode = statusCode; }

    public static Result<T> Ok(T value) => new(value);
    public static Result<T> Fail(string error, int statusCode = 400) => new(error, statusCode);
    public static Result<T> NotFound(string error) => new(error, 404);
    public static Result<T> Unauthorized(string error) => new(error, 401);
    public static Result<T> Conflict(string error) => new(error, 409);
}

public static class Result
{
    public static Result<T> Ok<T>(T value) => Result<T>.Ok(value);
    public static Result<T> Fail<T>(string error, int statusCode = 400) => Result<T>.Fail(error, statusCode);
    public static Result<T> NotFound<T>(string error) => Result<T>.NotFound(error);
}
