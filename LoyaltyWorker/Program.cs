using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using LoyaltyAPI;
using LoyaltyAPI.Services;
using Microsoft.Extensions.Configuration;

IHost host = Host.CreateDefaultBuilder(args)
    .UseWindowsService() // ✅ Important for Windows Service
    .ConfigureAppConfiguration((hostingContext, config) =>
    {
        config.AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);
        config.AddUserSecrets<LoyaltyAPI.Worker>();
    })
    .ConfigureServices((hostContext, services) =>
    {
        services.AddSignalR();
        services.AddSingleton<IHubConnection, HubConnectionService>();    
        services.AddHostedService<LoyaltyAPI.Worker>();
        
    })
    .Build();

host.Run();
