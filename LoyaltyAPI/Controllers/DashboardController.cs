using Dapper;
using LoyaltyAPI.Models; // <-- Uses the new models
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;
using System.Linq;
using Newtonsoft.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Authorization; // <-- ADDED: For security
using System.Data; // <-- ADDED: For Stored Procedure

namespace LoyaltyAPI.Controllers
{
    // Model to read the summary table row
    internal class DashboardSummaryData
    {
        public int Today_CouponsCreated { get; set; }
        public decimal Today_ValueCreated { get; set; }
        public int Today_CouponsRedeemed { get; set; }
        public decimal Today_ValueRedeemed { get; set; }
        public int Weekly_CouponsCreated { get; set; }
        public decimal Weekly_ValueCreated { get; set; }
        public int Weekly_CouponsRedeemed { get; set; }
        public decimal Weekly_ValueRedeemed { get; set; }
        public int ThirtyDay_CouponsCreated { get; set; }
        public decimal ThirtyDay_ValueCreated { get; set; }
        public int ThirtyDay_CouponsRedeemed { get; set; }
        public decimal ThirtyDay_ValueRedeemed { get; set; }
        public string? Today_CreatedByJson { get; set; }
        public string? Today_RedeemedByJson { get; set; }
        public string? Weekly_CreatedByJson { get; set; }
        public string? Weekly_RedeemedByJson { get; set; }
        public string? ThirtyDay_CreatedByJson { get; set; }
        public string? ThirtyDay_RedeemedByJson { get; set; }
        public string? LatestRedemptionsJson { get; set; }
        public string? PendingCustomersJson { get; set; }
        public string? TopRedeemersJson { get; set; }
        public string? InactiveCustomersJson { get; set; }
    }

    [Authorize] // <-- ADDED: Secures the entire controller
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;
        private readonly ILogger<DashboardController> _logger;

        public DashboardController(IConfiguration config, ILogger<DashboardController> logger)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _logger = logger;
            // Removed Billnus connection, as it's now only used inside the stored procedures
        }

        [HttpGet]
        public async Task<IActionResult> GetDashboardData()
        {
            var dashboard = new BeastDashboardViewModel();
            try
            {
                using var loyaltyConn = new SqlConnection(_loyaltyDbConnection);
                await loyaltyConn.OpenAsync();

                var sql = @"SELECT TOP 1 * FROM DashboardSummary ORDER BY GeneratedAt DESC";
                var summaryData = await loyaltyConn.QuerySingleOrDefaultAsync<DashboardSummaryData>(sql);

                // --- NEW: FALLBACK LOGIC ---
                if (summaryData == null)
                {
                    _logger.LogWarning("Dashboard summary data not found. Worker may be down. Calculating live fallback data via sp_GetDashboardFallback.");
                    var fallbackDashboard = await CalculateDashboardFallbackAsync(loyaltyConn);
                    return Ok(fallbackDashboard);
                }
                // --- END: FALLBACK LOGIC ---

                // 2. Populate stats
                dashboard.Stats.Today.CouponsCreated = summaryData.Today_CouponsCreated;
                dashboard.Stats.Today.ValueCreated = summaryData.Today_ValueCreated;
                dashboard.Stats.Today.CouponsRedeemed = summaryData.Today_CouponsRedeemed;
                dashboard.Stats.Today.ValueRedeemed = summaryData.Today_ValueRedeemed;

                dashboard.Stats.Weekly.CouponsCreated = summaryData.Weekly_CouponsCreated;
                dashboard.Stats.Weekly.ValueCreated = summaryData.Weekly_ValueCreated;
                dashboard.Stats.Weekly.CouponsRedeemed = summaryData.Weekly_CouponsRedeemed;
                dashboard.Stats.Weekly.ValueRedeemed = summaryData.Weekly_ValueRedeemed;

                dashboard.Stats.ThirtyDays.CouponsCreated = summaryData.ThirtyDay_CouponsCreated;
                dashboard.Stats.ThirtyDays.ValueCreated = summaryData.ThirtyDay_ValueCreated;
                dashboard.Stats.ThirtyDays.CouponsRedeemed = summaryData.ThirtyDay_CouponsRedeemed;
                dashboard.Stats.ThirtyDays.ValueRedeemed = summaryData.ThirtyDay_ValueRedeemed;

                // 3. Deserialize JSON
                dashboard.Stats.Today.CreatedBy = JsonConvert.DeserializeObject<List<CreatedBreakdown>>(summaryData.Today_CreatedByJson ?? "[]") ?? new List<CreatedBreakdown>();
                dashboard.Stats.Today.RedeemedBy = JsonConvert.DeserializeObject<List<RedeemedBreakdown>>(summaryData.Today_RedeemedByJson ?? "[]") ?? new List<RedeemedBreakdown>();
                dashboard.Stats.Weekly.CreatedBy = JsonConvert.DeserializeObject<List<CreatedBreakdown>>(summaryData.Weekly_CreatedByJson ?? "[]") ?? new List<CreatedBreakdown>();
                dashboard.Stats.Weekly.RedeemedBy = JsonConvert.DeserializeObject<List<RedeemedBreakdown>>(summaryData.Weekly_RedeemedByJson ?? "[]") ?? new List<RedeemedBreakdown>();
                dashboard.Stats.ThirtyDays.CreatedBy = JsonConvert.DeserializeObject<List<CreatedBreakdown>>(summaryData.ThirtyDay_CreatedByJson ?? "[]") ?? new List<CreatedBreakdown>();
                dashboard.Stats.ThirtyDays.RedeemedBy = JsonConvert.DeserializeObject<List<RedeemedBreakdown>>(summaryData.ThirtyDay_RedeemedByJson ?? "[]") ?? new List<RedeemedBreakdown>();
                dashboard.LatestRedemptions = JsonConvert.DeserializeObject<List<BeastLatestRedemption>>(summaryData.LatestRedemptionsJson ?? "[]") ?? new List<BeastLatestRedemption>();
                dashboard.PendingCustomers = JsonConvert.DeserializeObject<List<BeastPendingCustomer>>(summaryData.PendingCustomersJson ?? "[]") ?? new List<BeastPendingCustomer>();
                dashboard.TopRedeemers = JsonConvert.DeserializeObject<List<BeastTopRedeemer>>(summaryData.TopRedeemersJson ?? "[]") ?? new List<BeastTopRedeemer>();
                dashboard.InactiveCustomers = JsonConvert.DeserializeObject<List<BeastPendingCustomer>>(summaryData.InactiveCustomersJson ?? "[]") ?? new List<BeastPendingCustomer>();

                return Ok(dashboard);
            }
            catch (JsonException jsonEx)
            {
                _logger.LogError(jsonEx, "Error deserializing dashboard summary JSON data.");
                return Ok(dashboard);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving dashboard data from summary table.");
                return StatusCode(500, new { message = "An error occurred while loading dashboard data." });
            }
        }

        /// <summary>
        /// NEW FALLBACK METHOD: Calls the new stored procedure
        /// </summary>
        private async Task<BeastDashboardViewModel> CalculateDashboardFallbackAsync(SqlConnection loyaltyConn)
        {
            var dashboard = new BeastDashboardViewModel();
            try
            {
                using (var reader = await loyaltyConn.ExecuteReaderAsync(
                    "dbo.sp_GetDashboardFallback",
                    commandType: CommandType.StoredProcedure))
                {
                    // Result 1: Today's Stats
                    if (await reader.ReadAsync())
                    {
                        var stats = reader.Parse<TimePeriodStats>().FirstOrDefault();
                        if (stats != null)
                        {
                            dashboard.Stats.Today = stats;
                        }
                    }

                    // Result 2: Today's Created By
                    await reader.NextResultAsync();
                    dashboard.Stats.Today.CreatedBy = new List<CreatedBreakdown>();
                    while (await reader.ReadAsync())
                    {
                        dashboard.Stats.Today.CreatedBy.Add(new CreatedBreakdown
                        {
                            HandledBy = reader.GetString(reader.GetOrdinal("HandledBy")),
                            CreatedCount = reader.GetInt32(reader.GetOrdinal("CreatedCount"))
                        });
                    }

                    // Result 3: Today's Redeemed By
                    await reader.NextResultAsync();
                    dashboard.Stats.Today.RedeemedBy = new List<RedeemedBreakdown>();
                    while (await reader.ReadAsync())
                    {
                        dashboard.Stats.Today.RedeemedBy.Add(new RedeemedBreakdown
                        {
                            ClaimType = reader.GetString(reader.GetOrdinal("ClaimType")),
                            RedeemedCount = reader.GetInt32(reader.GetOrdinal("RedeemedCount"))
                        });
                    }

                    // Result 4: Latest Redemptions
                    await reader.NextResultAsync();
                    dashboard.LatestRedemptions = reader.Parse<BeastLatestRedemption>().ToList();
                }

                return dashboard;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CRITICAL: The dashboard fallback sp_GetDashboardFallback failed.");
                return new BeastDashboardViewModel(); // Return empty
            }
        }
    }
}