using Dapper;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.SignalR;
using LoyaltyAPI.Hubs;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using LoyaltyAPI.Services;
using LoyaltyAPI.Models;

namespace LoyaltyAPI
{
    public class Worker : BackgroundService, ISummaryUpdateService
    {
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<Worker> _logger;
        private readonly string? _billnusDbConnection;
        private readonly string? _loyaltyDbConnection;
        private readonly IHubConnection _hubConnection;
        private string _runMode = "24/7";
        private TimeOnly _startTime = TimeOnly.Parse("07:00");
        private TimeOnly _endTime = TimeOnly.Parse("22:00");
        private DateTime _lastSyncRun = DateTime.MinValue;
        private DateTime _lastSummaryRun = DateTime.MinValue;
        private TimeSpan _syncInterval;
        private TimeSpan _summaryInterval;
        private TimeSpan _pointCheckInterval;


        public Worker(ILogger<Worker> logger, IConfiguration config, IHubConnection hubConnection, IHubContext<NotificationHub> hubContext)
        {
            _hubContext = hubContext;
            _logger = logger;
            _billnusDbConnection = config.GetConnectionString("BillnusBP_DB");
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _hubConnection = hubConnection;

            // Set defaults in case DB load fails
            _syncInterval = TimeSpan.FromMinutes(60);
            _summaryInterval = TimeSpan.FromMinutes(2);
            _pointCheckInterval = TimeSpan.FromMinutes(1);

            if (string.IsNullOrEmpty(_loyaltyDbConnection))
            {
                _logger.LogCritical("CRITICAL: LoyaltyDB Connection String is not initialized. Worker cannot function.");
            }
        }

        private async Task LoadWorkerSettingsAsync()
        {
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                var settingsList = await conn.QueryAsync<(string Key, string Value)>(
                    "SELECT SettingKey, SettingValue FROM Settings WHERE SettingKey LIKE 'Worker_%IntervalMinutes'"
                );

                var settings = settingsList.ToDictionary(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase);

                if (settings.TryGetValue("Worker_SyncIntervalMinutes", out var syncVal) && int.TryParse(syncVal, out var syncMin))
                {
                    _syncInterval = TimeSpan.FromMinutes(syncMin);
                }
                if (settings.TryGetValue("Worker_SummaryIntervalMinutes", out var summaryVal) && int.TryParse(summaryVal, out var summaryMin))
                {
                    _summaryInterval = TimeSpan.FromMinutes(summaryMin);
                }
                if (settings.TryGetValue("Worker_PointCheckIntervalMinutes", out var pointVal) && int.TryParse(pointVal, out var pointMin))
                {
                    _pointCheckInterval = TimeSpan.FromMinutes(pointMin);
                }
                if (settings.TryGetValue("Worker_RunMode", out var mode))
                {
                    _runMode = mode;
                }
                if (settings.TryGetValue("Worker_StartTime", out var start) && TimeOnly.TryParse(start, out var startTime))
                {
                    _startTime = startTime;
                }
                if (settings.TryGetValue("Worker_EndTime", out var end) && TimeOnly.TryParse(end, out var endTime))
                {
                    _endTime = endTime;
                }
                _logger.LogInformation("Worker Run Mode: {Mode} (Active {Start} to {End})", _runMode, _startTime, _endTime);

                _logger.LogInformation("Worker settings loaded: SyncInterval={Sync}, SummaryInterval={Summary}, PointCheckInterval={Points}",
                    _syncInterval.TotalMinutes, _summaryInterval.TotalMinutes, _pointCheckInterval.TotalMinutes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load worker settings from DB. Using hardcoded defaults.");
            }
        }

        // --- THIS IS THE CORRECTED EXECUTEASYNC LOOP ---
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Loyalty Worker Service starting...");

            await LoadWorkerSettingsAsync();
            await _hubConnection.ConnectAsync();

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    if (_runMode == "BusinessHours")
                    {
                        var now = TimeOnly.FromDateTime(DateTime.Now);
                        if (now < _startTime || now > _endTime)
                        {
                            _logger.LogInformation("Worker is outside business hours. Sleeping for 15 minutes.");
                            await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken);
                            continue; // This skips the rest of the loop
                        }
                    }
                    // --- THESE NOW USE THE DYNAMIC VALUES AND CORRECT METHODS ---
                    if (DateTime.UtcNow - _lastSyncRun > _syncInterval)
                    {
                        // Run all long-running sync jobs
                        await RunJobWithAlertAsync("SyncCustomers", SyncCustomersAsync);
                        await RunJobWithAlertAsync("SyncStaff", SyncStaffAsync);
                        await RunJobWithAlertAsync("ExpireCoupons", ExpireOldCoupons);
                        _lastSyncRun = DateTime.UtcNow;
                    }

                    if (DateTime.UtcNow - _lastSummaryRun > _summaryInterval)
                    {
                        // Run dashboard summary
                        await RunJobWithAlertAsync("UpdateDashboardSummary", UpdateDashboardSummaryAsync);
                        _lastSummaryRun = DateTime.UtcNow;
                    }

                    // This task (PointCheck) runs on its own, faster interval
                    // We run this last as it depends on fresh data
                    await RunJobWithAlertAsync("ProcessCustomerPoints", ProcessCustomerPoints);

                    // The loop delay is now the SHORTEST interval
                    await Task.Delay(_pointCheckInterval, stoppingToken);
                    // --- END OF FIX ---
                }
                catch (OperationCanceledException)
                {
                    _logger.LogInformation("Worker stopping.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "An unhandled error occurred in the worker's main loop.");
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
            }

            _logger.LogInformation("Loyalty Worker Service stopped.");
        }
        // --- END OF CORRECTED LOOP ---

        private async Task RunJobWithAlertAsync(string jobName, Func<Task> jobAction)
        {
            try
            {
                _logger.LogInformation("JOB START: {JobName}", jobName);
                await jobAction();
                _logger.LogInformation("JOB SUCCESS: {JobName}", jobName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JOB FAILURE: {JobName} failed.");
                // In the future, you could add _emailService.SendAlertAsync here
            }
        }

        private class LastTransaction
        {
            public string? CreatedByUserID { get; set; }
            public DateTime BDate { get; set; }
        }

        private async Task<LastTransaction> GetLastTransactionDetails(string cardNo)
        {
            if (string.IsNullOrEmpty(_billnusDbConnection))
                return new LastTransaction { CreatedByUserID = "System", BDate = DateTime.Now };

            var sql = @"
            SELECT TOP 1 
                t.CreatedByUserID, 
                t.BDate 
            FROM [BillnusBP].[dbo].[Billing_Entry_SpaShop] t
            WHERE t.CardNo = @CardNo 
              AND ISNULL(t.CreatedByUserID, '') <> '' 
            ORDER BY t.BillNo DESC, t.BDate DESC; 
        ";

            using (var conn = new SqlConnection(_billnusDbConnection))
            {
                try
                {
                    var result = await conn.QuerySingleOrDefaultAsync<LastTransaction>(sql, new { CardNo = cardNo });
                    return result ?? new LastTransaction { CreatedByUserID = "System", BDate = DateTime.Now };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"CRITICAL SQL ERROR: Failed to fetch Staff/Date from BillnusBP for CardNo {cardNo}.");
                    return new LastTransaction { CreatedByUserID = "System", BDate = DateTime.Now };
                }
            }
        }

        private async Task SyncCustomersAsync()
        {
            if (string.IsNullOrEmpty(_billnusDbConnection))
            {
                _logger.LogWarning("SYNC FAIL: BillnusBP_DB Connection string is null. Skipping customer sync.");
                return;
            }

            var sql = $@"
                MERGE INTO [LoyaltyDB].[dbo].[Customers] AS target
                USING (
                    SELECT CardNo, CName, CContact, UserID
                    FROM [BillnusBP].[dbo].[Customer_Entry] WITH (NOLOCK) 
                    WHERE CardNo IS NOT NULL AND CardNo != ''
                ) AS source
                ON (target.CardNo = source.CardNo)
                WHEN MATCHED THEN UPDATE SET target.CName = source.CName, target.CContact = source.CContact, target.CreatedByUserID = source.UserID
                WHEN NOT MATCHED BY TARGET THEN INSERT (CardNo, CName, CContact, CreatedByUserID) VALUES (source.CardNo, source.CName, source.CContact, source.UserID)
                WHEN NOT MATCHED BY SOURCE THEN DELETE;
            ";

            using (var conn = new SqlConnection(_billnusDbConnection))
            {
                int rowsAffected = await conn.ExecuteAsync(sql);
                _logger.LogInformation($"SYNC: Customer sync complete. {rowsAffected} rows affected.");
            }
        }

        private async Task SyncStaffAsync()
        {
            if (string.IsNullOrEmpty(_billnusDbConnection))
            {
                _logger.LogWarning("SYNC FAIL: BillnusBP_DB Connection string is null. Skipping staff sync.");
                return;
            }
            var sql = @"
                MERGE INTO [LoyaltyDB].[dbo].[Staff] AS target
                USING (
                    SELECT DISTINCT CreatedByUserID
                    FROM [BillnusBP].[dbo].[Billing_Entry_SpaShop]
                    WHERE CreatedByUserID IS NOT NULL AND CreatedByUserID != ''
                ) AS source (StaffName)
                ON (target.StaffName = source.StaffName)
                WHEN NOT MATCHED BY TARGET THEN INSERT (StaffName) VALUES (source.StaffName)
                WHEN NOT MATCHED BY SOURCE THEN DELETE;
            ";

            using (var conn = new SqlConnection(_billnusDbConnection))
            {
                int rowsAffected = await conn.ExecuteAsync(sql);
                _logger.LogInformation($"SYNC: Staff sync complete. {rowsAffected} rows affected.");
            }
        }

        private async Task ExpireOldCoupons()
        {
            var sql = @"UPDATE Coupons SET Status = 'Expired' WHERE Status = 'Pending' AND ExpiryDate IS NOT NULL AND ExpiryDate < GETDATE();";
            using (var conn = new SqlConnection(_loyaltyDbConnection))
            {
                int rowsAffected = await conn.ExecuteAsync(sql);
                if (rowsAffected > 0)
                {
                    _logger.LogInformation($"EXPIRED: Successfully expired {rowsAffected} coupons.");
                }
            }
        }

        private async Task<Promotion?> GetActivePromotion()
        {
            var sql = @"SELECT TOP 1 PromotionID, Name, StartDate, EndDate, CouponValue, IsEnabled FROM Promotions WHERE IsEnabled = 1 AND GETDATE() BETWEEN StartDate AND EndDate ORDER BY CouponValue DESC;";
            using (var conn = new SqlConnection(_loyaltyDbConnection))
            {
                return await conn.QuerySingleOrDefaultAsync<Promotion>(sql);
            }
        }

        public async Task UpdateDashboardSummaryAsync()
        {
            _logger.LogInformation("Worker: Running dashboard summary update...");
            try
            {
                using var loyaltyConn = new SqlConnection(_loyaltyDbConnection);
                await loyaltyConn.ExecuteAsync(
                    "dbo.sp_UpdateDashboardSummary",
                    commandType: CommandType.StoredProcedure,
                    commandTimeout: 300
                );
                _logger.LogInformation("SUMMARY: Dashboard summary table updated successfully via sp_UpdateDashboardSummary.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Worker: Failed to run UpdateDashboardSummary.");
            }
        }

        private async Task ProcessCustomerPoints()
        {
            if (string.IsNullOrEmpty(_loyaltyDbConnection) || string.IsNullOrEmpty(_billnusDbConnection))
            {
                _logger.LogWarning("POINTS FAIL: Cannot process points; connection strings are null.");
                return;
            }

            TierSettings settings = await GetTierSettings();
            Promotion? activePromotion = await GetActivePromotion();

            if (activePromotion != null)
            {
                _logger.LogInformation($"ACTIVE PROMOTION: '{activePromotion.Name}' active. Value = {activePromotion.CouponValue} rs.");
            }

            var findCustomersSql = @"SELECT CardNo, Points, CName, CContact FROM [BillnusBP].[dbo].[Customer_Entry] WHERE Points >= @MinPointsRequired AND CardNo IS NOT NULL AND CardNo != ''";

            double minPointsRequired = Math.Min(settings.PointsPerCoupon_Bronze, Math.Min(settings.PointsPerCoupon_Silver, settings.PointsPerCoupon_Gold));
            if (minPointsRequired <= 0) minPointsRequired = 100;

            IEnumerable<dynamic> customersToProcess;
            using (var billnusConnection = new SqlConnection(_billnusDbConnection))
            {
                customersToProcess = await billnusConnection.QueryAsync(findCustomersSql, new { MinPointsRequired = minPointsRequired });
            }

            HashSet<string> blacklist;
            using (var loyConn = new SqlConnection(_loyaltyDbConnection))
            {
                var blacklistedCards = await loyConn.QueryAsync<string>("SELECT CardNo FROM [dbo].[CustomerBlacklist]");
                blacklist = new HashSet<string>(blacklistedCards, StringComparer.OrdinalIgnoreCase);
            }
            _logger.LogInformation("Loaded {Count} customers on the blacklist.", blacklist.Count);

            bool dataWasChanged = false;

            foreach (var customer in customersToProcess)
            {
                string cardNo = customer.CardNo;
                if (blacklist.Contains(cardNo))
                {
                    _logger.LogWarning("Skipping point processing for blacklisted customer: {CardNo}", cardNo);
                    continue;
                }

                LastTransaction transDetails = await GetLastTransactionDetails(cardNo);
                string handledByValue = transDetails.CreatedByUserID ?? "System";
                DateTime dateCreated = transDetails.BDate;

                string customerTier;
                using (var loyaltyConnTier = new SqlConnection(_loyaltyDbConnection))
                {
                    customerTier = await GetCustomerTier(cardNo, settings, loyaltyConnTier);
                }

                double pointsPerCoupon, couponValue;
                switch (customerTier)
                {
                    case "Gold": pointsPerCoupon = settings.PointsPerCoupon_Gold; couponValue = settings.CouponValue_Gold; break;
                    case "Silver": pointsPerCoupon = settings.PointsPerCoupon_Silver; couponValue = settings.CouponValue_Silver; break;
                    default: pointsPerCoupon = settings.PointsPerCoupon_Bronze; couponValue = settings.CouponValue_Bronze; break;
                }

                if (activePromotion != null)
                {
                    couponValue = (double)activePromotion.CouponValue;
                }

                double totalPoints = customer.Points ?? 0;
                if (totalPoints < pointsPerCoupon) continue;

                int newCouponsCount = (int)(totalPoints / pointsPerCoupon);
                double pointsToLeave = totalPoints % pointsPerCoupon;

                _logger.LogInformation($"Processing Customer {cardNo} (Tier: {customerTier}): Found {totalPoints} points. Creating {newCouponsCount} coupons...");

                string customerName = customer.CName ?? cardNo;
                string detailedMessage = $"{customerName} ({cardNo}) created {newCouponsCount} coupon(s). Handled by: {handledByValue}.";

                using (var loyaltyConnection = new SqlConnection(_loyaltyDbConnection))
                {
                    await loyaltyConnection.OpenAsync();
                    using (var billnusConnection = new SqlConnection(_billnusDbConnection))
                    {
                        await billnusConnection.OpenAsync();
                        using (var transaction = loyaltyConnection.BeginTransaction())
                        {
                            try
                            {
                                var createCouponSql = @"
                                INSERT INTO Coupons (CardNo, Value, Status, DateCreated, ExpiryDate, HandledBy)
                                VALUES (@CardNo, @Value, 'Pending', @DateCreated,
                                DATEADD(day, @ExpiryDays, @DateCreated), @HandledBy)";

                                for (int i = 0; i < newCouponsCount; i++)
                                {
                                    await loyaltyConnection.ExecuteAsync(createCouponSql,
                                        new { CardNo = cardNo, Value = couponValue, DateCreated = dateCreated, ExpiryDays = settings.DefaultExpiryDays, HandledBy = handledByValue },
                                        transaction
                                    );
                                }

                                var updatePointsSql = @"UPDATE Customer_Entry SET Points = @PointsToLeave WHERE CardNo = @CardNo";
                                await billnusConnection.ExecuteAsync(updatePointsSql, new { PointsToLeave = pointsToLeave, CardNo = cardNo });

                                var notifySql = @"INSERT INTO Notifications (Message) VALUES (@Message)";
                                await loyaltyConnection.ExecuteAsync(notifySql, new { Message = detailedMessage }, transaction);

                                transaction.Commit();
                                dataWasChanged = true;

                                await _hubConnection.SendPointsConvertedAsync(detailedMessage);
                            }
                            catch (Exception ex)
                            {
                                try { transaction.Rollback(); } catch { }
                                _logger.LogError(ex, $"FAILED: Could not process customer {cardNo}.");
                            }
                        }
                    }
                }
            }

            if (dataWasChanged)
            {
                _logger.LogInformation("Data was changed, rebuilding dashboard summary and sending SignalR refresh...");
                try
                {
                    await UpdateDashboardSummaryAsync(); // Run the summary SP
                    await _hubConnection.SendDashboardUpdateAsync(); // Send the SignalR refresh
                    _logger.LogInformation("Dashboard refresh signal sent.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to update dashboard summary after point processing.");
                }
            }
        }

        private async Task<string> GetCustomerTier(string cardNo, TierSettings settings, SqlConnection conn)
        {
            var sql = @"SELECT CASE WHEN COUNT(CouponID) >= @GoldThreshold THEN 'Gold' WHEN COUNT(CouponID) >= @SilverThreshold THEN 'Silver' ELSE 'Bronze' END FROM [LoyaltyDB].[dbo].[Coupons] WHERE Status = 'Redeemed' AND CardNo = @CardNo";
            return await conn.QuerySingleOrDefaultAsync<string>(sql, new { CardNo = cardNo, GoldThreshold = settings.TierThreshold_Gold, SilverThreshold = settings.TierThreshold_Silver }) ?? "Bronze";
        }

        private async Task<TierSettings> GetTierSettings()
        {
            using var conn = new SqlConnection(_loyaltyDbConnection);
            try
            {
                var settingsList = await conn.QueryAsync<(string Key, string Value)>("SELECT SettingKey, SettingValue FROM Settings");
                var d = settingsList.ToDictionary(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase);

                double.TryParse(d.GetValueOrDefault("PointsPerCoupon_Bronze"), out var pb);
                double.TryParse(d.GetValueOrDefault("CouponValue_Bronze"), out var vb);
                double.TryParse(d.GetValueOrDefault("PointsPerCoupon_Silver"), out var ps);
                double.TryParse(d.GetValueOrDefault("CouponValue_Silver"), out var vs);
                double.TryParse(d.GetValueOrDefault("PointsPerCoupon_Gold"), out var pg);
                double.TryParse(d.GetValueOrDefault("CouponValue_Gold"), out var vg);
                int.TryParse(d.GetValueOrDefault("DefaultExpiryDays"), out var exp);
                int.TryParse(d.GetValueOrDefault("TierThreshold_Silver"), out var ts);
                int.TryParse(d.GetValueOrDefault("TierThreshold_Gold"), out var tg);

                return new TierSettings
                {
                    PointsPerCoupon_Bronze = pb > 0 ? pb : 100,
                    CouponValue_Bronze = vb > 0 ? vb : 250,
                    PointsPerCoupon_Silver = ps > 0 ? ps : 100,
                    CouponValue_Silver = vs > 0 ? vs : 275,
                    PointsPerCoupon_Gold = pg > 0 ? pg : 100,
                    CouponValue_Gold = vg > 0 ? vg : 300,
                    DefaultExpiryDays = exp > 0 ? exp : 90,
                    TierThreshold_Silver = ts > 0 ? ts : 10,
                    TierThreshold_Gold = tg > 0 ? tg : 50
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get TierSettings from database. Using default values.");
                return new TierSettings();
            }
        }
    }
}