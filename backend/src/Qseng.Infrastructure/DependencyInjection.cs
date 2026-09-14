using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Qseng.Application.Abstractions;
using Qseng.Infrastructure.Auth;
using Qseng.Infrastructure.Files;
using Qseng.Infrastructure.Parsing;
using Qseng.Infrastructure.Persistence;
using Qseng.Infrastructure.Seeding;

namespace Qseng.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration cfg)
    {
        var provider = (cfg["DB_PROVIDER"] ?? cfg["Database:Provider"] ?? "sqlite").ToLowerInvariant();
        var conn = cfg["CONNECTION_STRING"] ?? cfg.GetConnectionString("Default") ?? "Data Source=qseng.db";

        // Each provider has its own context and migration chain; both are applied
        // with Migrate() so the dev and prod schemas cannot drift apart.
        switch (provider)
        {
            case "postgres":
            case "postgresql":
                services.AddDbContext<QsengDbContext, PostgresQsengDbContext>(opt => opt.UseNpgsql(conn));
                break;
            default:
                services.AddDbContext<QsengDbContext, SqliteQsengDbContext>(opt => opt.UseSqlite(conn));
                break;
        }

        services.AddScoped<IQsengDbContext>(sp => sp.GetRequiredService<QsengDbContext>());
        services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IGenealogyParser, GenealogyTextParser>();
        services.AddScoped<IFileStorage, LocalFileStorage>();
        services.AddScoped<DbSeeder>();
        return services;
    }
}
