using System.Threading.Tasks;

namespace LoyaltyAPI.Services
{
    public interface IHubConnection
    {
        Task ConnectAsync();
        Task DisconnectAsync();
        Task SendDashboardUpdateAsync();
        Task SendPointsConvertedAsync(string message);

    }

}