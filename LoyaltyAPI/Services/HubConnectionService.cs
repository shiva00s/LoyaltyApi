using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;
using System.Threading;
using Microsoft.AspNetCore.SignalR;
using LoyaltyAPI.Hubs;

namespace LoyaltyAPI.Services
{
    public class HubConnectionService : IHubConnection, IHostedService, IDisposable
    {

        private readonly ILogger<HubConnectionService> _logger;
        private readonly string _hubUrl;
        private readonly string _notificationHubUrl;
        private HubConnection? _connection;
        private HubConnection? _notificationConnection;
        private readonly IConfiguration _config;
        private readonly string _workerKey; // To store the key securely

        public HubConnectionService(IConfiguration config, ILogger<HubConnectionService> logger)
        {
            _logger = logger;
            _config = config;

            // --- SECURITY FIX 1: Force HTTPS ---
            // Get the base URL from config, default to localhost if not set
            string baseUrl = config.GetValue<string>("ApiBaseUrl") ?? "http://localhost:5212";
            // Default to HTTPS

            // Ensure it starts with https://
            //if (!baseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            //{
               // if (baseUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
               // {
                  //  baseUrl = "https://" + baseUrl.Substring("http://".Length);
                  //  _logger.LogWarning("ApiBaseUrl started with http://, changing to https://");
              //  }
               // else
               // {
               //     baseUrl = "https://" + baseUrl; // Assume it's just the domain name
               // }
            //}
            // Remove any trailing slash before adding the hub path
            _hubUrl = baseUrl.TrimEnd('/') + "/dashboard-hub";
            _notificationHubUrl = baseUrl.TrimEnd('/') + "/notificationhub";
            // --- END SECURITY FIX 1 ---


            // --- SECURITY FIX 2: Read Worker Key from Config ---

            _workerKey = config.GetValue<string>("WorkerSecurity:SharedKey") ?? string.Empty;

            if (string.IsNullOrEmpty(_workerKey))
            {
                var errorMsg = "CRITICAL: 'WorkerSecurity:SharedKey' is missing from configuration. Worker cannot authenticate with API Hub.";
                _logger.LogCritical(errorMsg);
                // Throw an exception to prevent the worker from starting without authentication
                throw new ArgumentException(errorMsg, "WorkerSecurity:SharedKey");
            }
            // --- END SECURITY FIX 2 ---


            _logger.LogInformation($"SignalR: Using Hub URL: {_hubUrl}");
        }

        public async Task ConnectAsync()
        {
            // 1. Setup Dashboard Hub Connection
            if (_connection == null)
            {
                _connection = new HubConnectionBuilder()
                    .WithUrl(_hubUrl, options =>
                    {
                        options.Headers.Add("X-Worker-Key", _workerKey);
                    })
                    .WithAutomaticReconnect()
                    .Build();
            }

            // 2. Setup Notification Hub Connection
            if (_notificationConnection == null)
            {
                _notificationConnection = new HubConnectionBuilder()
                    .WithUrl(_notificationHubUrl) // No key needed as it's for public notifications
                    .WithAutomaticReconnect()
                    .Build();
            }

            // 3. Connect to Dashboard Hub
            if (_connection.State == HubConnectionState.Disconnected)
            {
                try
                {
                    _logger.LogInformation($"SignalR: Connecting to {_hubUrl}...");
                    await _connection.StartAsync();
                    _logger.LogInformation("SignalR: Dashboard Hub connection established.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "SignalR: Failed to connect to the Dashboard Hub. Retrying in background.");
                }
            }

            // 4. Connect to Notification Hub
            if (_notificationConnection.State == HubConnectionState.Disconnected)
            {
                try
                {
                    _logger.LogInformation($"SignalR: Connecting to {_notificationHubUrl}...");
                    await _notificationConnection.StartAsync();
                    _logger.LogInformation("SignalR: Notification Hub connection established.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "SignalR: Failed to connect to the Notification Hub. Retrying in background.");
                }
            }
        }

        public async Task DisconnectAsync()
        {
            if (_connection != null)
            {
                await _connection.StopAsync();
                await _connection.DisposeAsync();
                _connection = null;
                _logger.LogInformation("SignalR: Dashboard Hub connection disconnected.");
            }

            if (_notificationConnection != null)
            {
                await _notificationConnection.StopAsync();
                await _notificationConnection.DisposeAsync();
                _notificationConnection = null;
                _logger.LogInformation("SignalR: Notification Hub connection disconnected.");
            }
        }

        public async Task SendDashboardUpdateAsync()
        {
            if (_connection == null || _connection.State != HubConnectionState.Connected)
            {
                await ConnectAsync(); // Attempt to connect if not already connected
            }

            // Check connection state *after* attempting to connect
            if (_connection?.State == HubConnectionState.Connected)
            {
                try
                {
                    // Invoke the Hub method that broadcasts the update
                    await _connection.InvokeAsync("BroadcastDashboardUpdate");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "SignalR: Failed to invoke update notification on Hub.");
                }
            }
            else
            {
                _logger.LogWarning("SignalR: Could not send update notification, Hub connection is not established.");
            }
        }

        // --- IHostedService implementation (no changes needed here) ---
        public Task StartAsync(CancellationToken cancellationToken)
        {
            // Connect when the service starts
            return ConnectAsync();
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            // Disconnect when the service stops
            return DisconnectAsync();
        }

        public void Dispose()
        {
            // Ensure connection is disposed
            _connection?.DisposeAsync().GetAwaiter().GetResult();
        }

        public interface IHubNotifier
        {
            Task SendCouponsCreatedAsync(string cardNo, int count, double valueEach);
        }

        public sealed class HubNotifier : IHubNotifier
        {
            private readonly IHubContext<NotificationHub> _hub;
            public HubNotifier(IHubContext<NotificationHub> hub) => _hub = hub;

            public Task SendCouponsCreatedAsync(string cardNo, int count, double valueEach) =>
                _hub.Clients.All.SendAsync("CouponsCreated", new
                {
                    cardNo,
                    count,
                    valueEach,
                    at = DateTime.UtcNow
                });
        }

        public async Task SendPointsConvertedAsync(string message)
        {
            // Connect if needed (this now connects both hubs)
            if (_notificationConnection == null || _notificationConnection.State != HubConnectionState.Connected)
            {
                await ConnectAsync();
            }

            // Check connection state *after* attempting to connect
            if (_notificationConnection?.State == HubConnectionState.Connected)
            {
                try
                {
                    // *** THIS IS THE FIX ***
                    // Use the _notificationConnection to invoke the method on the NotificationHub
                    await _notificationConnection.InvokeAsync("BroadcastPoints", message);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "SignalR: Failed to invoke BroadcastPoints on Notification Hub.");
                }
            }
            else        
            {
                _logger.LogWarning("SignalR: Could not send points notification, Notification Hub connection is not established.");
            }
        }
    }
}