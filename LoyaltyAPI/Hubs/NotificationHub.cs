using Microsoft.AspNetCore.SignalR;

namespace LoyaltyAPI.Hubs
{
    public class NotificationHub : Hub
    {
        public override Task OnConnectedAsync()
        {
            Console.WriteLine("✅ NotificationHub: Client connected " + Context.ConnectionId);
            return base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? ex)
        {
            Console.WriteLine("❌ NotificationHub: Client disconnected");
            return base.OnDisconnectedAsync(ex);
        }

        // Worker/Server will call this; clients receive "PointsConverted"
        public Task BroadcastPoints(string message)
        {
            return Clients.All.SendAsync("PointsConverted", message);
        }
    }
}
