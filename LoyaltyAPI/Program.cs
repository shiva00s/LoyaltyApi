using Hangfire.Server;
using LoyaltyAPI.Hubs;
using LoyaltyAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Threading.Tasks;

var builder = WebApplication.CreateBuilder(args);

// Run as Windows Service
builder.Host.UseWindowsService();


// ------------------------------------------------------
// 1. REGISTER SERVICES
// ------------------------------------------------------

// Logging
builder.Services.AddLogging();

// MVC Controllers
builder.Services.AddControllers();

// SignalR
builder.Services.AddSignalR();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5212")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Dependency Injection
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<IPrinterService, PrinterService>();
//builder.Services.AddScoped<IEmailService, EmailService>();


// ------------------------------------------------------
// JWT Authentication
// ------------------------------------------------------
var securityKey = builder.Configuration.GetValue<string>("SecurityKey");

if (string.IsNullOrEmpty(securityKey) || securityKey.Length < 32)
{
    Console.Error.WriteLine("CRITICAL: 'SecurityKey' missing or too short (minimum 32 chars).");
    throw new ArgumentException("CRITICAL: 'SecurityKey' is missing or too short.", "SecurityKey");
}

var key = Encoding.ASCII.GetBytes(securityKey);

builder.Services.AddAuthentication(x =>
{
    x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(x =>
{
    x.RequireHttpsMetadata = false;
    x.SaveToken = true;

    x.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false
    };

    // Allow JWT via query for SignalR
    x.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/dashboard-hub"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

// Authorization
builder.Services.AddAuthorization();


// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "LoyaltyAPI", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Enter JWT token with Bearer prefix",
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
    {
        new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference
            {
                Type = ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        },
        new string[] {}
    }});
});


// ------------------------------------------------------
// 2. BUILD
// ------------------------------------------------------
var app = builder.Build();


// ------------------------------------------------------
// 3. MIDDLEWARE PIPELINE
// ------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI(c =>
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "LoyaltyAPI v1"));
}

// app.UseHttpsRedirection(); // Enable if API uses HTTPS

app.UseCors("AllowReactApp");

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseWebSockets();

app.UseDefaultFiles();   // Serves index.html by default
app.UseStaticFiles();    // Serves files from wwwroot

app.MapFallbackToFile("index.html");


// ------------------------------------------------------
// 4. MAP ROUTES & SIGNALR HUBS
// ------------------------------------------------------
app.MapControllers();

app.MapHub<DashboardHub>("/dashboard-hub");
app.MapHub<NotificationHub>("/notificationhub");


// ------------------------------------------------------
// 5. RUN
// ------------------------------------------------------
app.Run();