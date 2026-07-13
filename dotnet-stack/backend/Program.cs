using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using WildernessStays.Api.Hubs;
using WildernessStays.Core;
using WildernessStays.Core.Data;
using WildernessStays.Core.Events;
using WildernessStays.Core.Services;

var builder = WebApplication.CreateBuilder(args);

// ---- Core library: data layer + business logic (from the WildernessStays.Core NuGet) ----
var coreOptions = new WildernessOptions
{
    JwtSecret = builder.Configuration["Jwt:Secret"] ?? new WildernessOptions().JwtSecret,
    RedisConnection = builder.Configuration["Redis"] ?? "localhost:6380",
    StripeSecretKey = builder.Configuration["Stripe:SecretKey"],
};
builder.Services.AddSignalR();
builder.Services.AddSingleton<IBookingEvents, SignalRBookingEvents>();
builder.Services.AddWildernessStaysCore(builder.Configuration.GetConnectionString("Default")!, coreOptions);

// ---- HTTP concerns ----
builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);

// Nest-compatible validation error shape: { message: [ ... ] }
builder.Services.Configure<ApiBehaviorOptions>(o =>
    o.InvalidModelStateResponseFactory = ctx => new BadRequestObjectResult(new
    {
        message = ctx.ModelState.Values
            .SelectMany(v => v.Errors)
            .Select(e => e.ErrorMessage)
            .ToArray(),
    }));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new()
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            IssuerSigningKey = TokenService.Key(coreOptions.JwtSecret),
            RoleClaimType = "role",
            NameClaimType = "name",
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyHeader().AllowAnyMethod().SetIsOriginAllowed(_ => true).AllowCredentials()));

var app = builder.Build();

// Map domain exceptions from the core library onto HTTP responses.
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (ApiException ex)
    {
        context.Response.StatusCode = ex.StatusCode;
        await context.Response.WriteAsJsonAsync(new { message = ex.Message });
    }
});

// Minimal security headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    await next();
});

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<EventsHub>("/hubs/events");

// Create database if missing, then seed hotels/rooms/users/bookings.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await Seeder.RunAsync(db, logger);
}

app.Logger.LogInformation("Wilderness Stays API (ASP.NET Core, layered) on {Urls} — Swagger at /swagger",
    builder.Configuration["Urls"]);
app.Run();
