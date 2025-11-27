using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;

namespace LoyaltyAPI.Hubs
{
    [AllowAnonymous] // Allows the worker (system service) to connect
    public class DashboardHub : Hub
    {
        public override Task OnConnectedAsync()
        {
            Console.WriteLine("✅ DashboardHub: Client connected " + Context.ConnectionId);
            return base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? ex)
        {
            Console.WriteLine("❌ DashboardHub: Client disconnected");
            return base.OnDisconnectedAsync(ex);
        }

        // ✅ REQUIRED BY WORKER
        public async Task BroadcastDashboardUpdate()
        {
            await Clients.All.SendAsync("DashboardUpdated");
        }
    }

}