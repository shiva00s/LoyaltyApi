using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration; // Needed for IConfiguration
using System.Linq; // Needed for ToDictionary
using System.Threading.Tasks;

namespace LoyaltyAPI.Services
{
    // Interface defining the contract
    public interface ISettingsService
    {
        Task<(int Silver, int Gold)> GetTierThresholdsAsync();
        //Task<Dictionary<string, string>> GetEmailSettingsAsync();
    }



    // Implementation of the service
    public class SettingsService : ISettingsService
    {
        public async Task<Dictionary<string, string>> GetEmailSettingsAsync()
        {
            using var conn = new SqlConnection(_loyaltyDbConnection);
            var keys = new[] { "Email_EnableAlerts", "Email_AdminAddress", "Email_SendGridKey" };
            var settingsList = await conn.QueryAsync<(string Key, string Value)>(
                "SELECT SettingKey, SettingValue FROM Settings WHERE SettingKey IN @Keys",
                new { Keys = keys }
            );
            return settingsList.ToDictionary(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase);
        }

        private readonly string? _loyaltyDbConnection;

        public SettingsService(IConfiguration config)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
        }

        /// <summary>
        /// Gets the Silver and Gold tier threshold values from the database settings.
        /// </summary>
        /// <returns>A tuple containing the Silver and Gold thresholds.</returns>
        public async Task<(int Silver, int Gold)> GetTierThresholdsAsync()
        {
            using var conn = new SqlConnection(_loyaltyDbConnection);
            // Query only the needed settings
            var settingsList = await conn.QueryAsync<(string Key, string Value)>(
                "SELECT SettingKey, SettingValue FROM Settings WHERE SettingKey IN ('TierThreshold_Silver', 'TierThreshold_Gold')"
            );

            // Convert to dictionary for easy lookup
            var settingsDict = settingsList.ToDictionary(s => s.Key, s => s.Value);

            // Parse values with defaults
            int.TryParse(settingsDict.GetValueOrDefault("TierThreshold_Silver"), out var ts);
            int.TryParse(settingsDict.GetValueOrDefault("TierThreshold_Gold"), out var tg);

            // Return the thresholds, ensuring they are at least the default values
            return (
                Silver: ts > 0 ? ts : 10, // Default Silver = 10
                Gold: tg > 0 ? tg : 50   // Default Gold = 50
            );
        }       

    }
    
}