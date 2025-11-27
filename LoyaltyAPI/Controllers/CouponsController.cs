using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System;
using System.Data;
using Microsoft.AspNetCore.SignalR;
using LoyaltyAPI.Hubs;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using System.Linq;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using LoyaltyAPI.Models;

namespace LoyaltyAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CouponsController : ControllerBase
    {
        private readonly IHubContext<DashboardHub> _dashboardHub;
        private readonly string? _loyaltyDbConnection;
        private readonly IConfiguration _config;
        private readonly ILogger<CouponsController> _logger;

        public CouponsController(IConfiguration config, ILogger<CouponsController> logger, IHubContext<DashboardHub> dashboardHub)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _config = config;
            _logger = logger;
            _dashboardHub = dashboardHub;
        }

        public class ManualAddRequest
        {
            public required string CardNo { get; set; }
            public required string Reason { get; set; }
            public required string HandledBy { get; set; }
        }

        // --- THIS IS THE FIX ---
        public class BulkAddRequest
        {
            public decimal CouponValue { get; set; }
            public int ExpiryDays { get; set; }
            public int CouponCount { get; set; } // <-- ADDED THIS
            public required string ClaimType { get; set; }
            public required string HandledBy { get; set; }
            public required List<string>? CardNos { get; set; }
        }
        // --- END FIX ---

        public class MergeRequest
        {
            public required string SourceCardNo { get; set; }
            public required string TargetCardNo { get; set; }
            public required string MergedBy { get; set; }
        }

        // (Helper methods GetTierThresholds and GetCustomerTier are unchanged)
        private async Task<(int Silver, int Gold)> GetTierThresholds(SqlConnection conn, SqlTransaction trans)
        {
            var settingsList = await conn.QueryAsync<(string Key, string Value)>(
                "SELECT SettingKey, SettingValue FROM Settings WHERE SettingKey IN ('TierThreshold_Silver', 'TierThreshold_Gold')",
                transaction: trans
            );
            var settingsDict = settingsList.ToDictionary(s => s.Key, s => s.Value);
            int.TryParse(settingsDict.GetValueOrDefault("TierThreshold_Silver"), out var ts);
            int.TryParse(settingsDict.GetValueOrDefault("TierThreshold_Gold"), out var tg);
            return (Silver: ts > 0 ? ts : 10, Gold: tg > 0 ? tg : 50);
        }
        private async Task<string> GetCustomerTier(string cardNo, (int Silver, int Gold) thresholds, SqlConnection conn, SqlTransaction trans)
        {
            var sql = @"SELECT COUNT(CouponID) FROM [LoyaltyDB].[dbo].[Coupons] WHERE Status = 'Redeemed' AND CardNo = @CardNo";
            int redeemedCount = await conn.ExecuteScalarAsync<int>(sql, new { CardNo = cardNo }, transaction: trans);
            if (redeemedCount >= thresholds.Gold) return "Gold";
            if (redeemedCount >= thresholds.Silver) return "Silver";
            return "Bronze";
        }


        // (ManualAddCoupon is unchanged)
        [HttpPost("manual-add")]
        public async Task<IActionResult> ManualAddCoupon([FromBody] ManualAddRequest request)
        {
            if (string.IsNullOrEmpty(request.CardNo) || string.IsNullOrEmpty(request.HandledBy))
            {
                return BadRequest(new { message = "CardNo and HandledBy are required." });
            }
            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.OpenAsync();
            var couponValueSql = "SELECT SettingValue FROM Settings WHERE SettingKey = 'CouponValue_Bronze'";
            var couponValue = await conn.ExecuteScalarAsync<decimal>(couponValueSql);
            if (couponValue == 0) couponValue = 250;
            var sql = @"
                INSERT INTO Coupons (CardNo, Value, Status, DateCreated, ClaimType, HandledBy) 
                VALUES (@CardNo, @Value, 'Pending', GETDATE(), 'Manual Add', @HandledBy);
            ";
            await conn.ExecuteAsync(sql, new
            {
                CardNo = request.CardNo,
                Value = couponValue,
                HandledBy = $"{request.HandledBy} ({request.Reason})"
            });

            // Send SignalR refresh
            await _dashboardHub.Clients.All.SendAsync("ReceiveDashboardUpdate", "Manual coupon added");
            return Ok(new { message = "Coupon manually added successfully." });
        }


        // --- THIS IS THE FIX ---
        [Authorize(Roles = "Admin")]
        [HttpPost("bulk-add")]
        public async Task<IActionResult> BulkAddCoupons([FromBody] BulkAddRequest request)
        {
            if (request.CouponValue <= 0 || request.ExpiryDays <= 0 || request.CouponCount <= 0)
            {
                return BadRequest(new { message = "Value, Expiry Days, and Coupon Count must be greater than zero." });
            }
            if (string.IsNullOrEmpty(request.ClaimType) || string.IsNullOrEmpty(request.HandledBy))
            {
                return BadRequest(new { message = "ClaimType and HandledBy are required." });
            }

            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.OpenAsync();
            using var transaction = conn.BeginTransaction();

            IEnumerable<string> cardNos;
            if (request.CardNos != null && request.CardNos.Any())
            {
                cardNos = request.CardNos.Distinct();
            }
            else
            {
                cardNos = await conn.QueryAsync<string>("SELECT CardNo FROM Customers", transaction: transaction);
            }

            int totalInserts = 0;
            int totalCustomers = 0;

            try
            {
                var insertSql = @"
                    INSERT INTO Coupons (CardNo, Value, Status, DateCreated, ExpiryDate, ClaimType, HandledBy) 
                    VALUES (@CardNo, @Value, 'Pending', GETDATE(), DATEADD(day, @ExpiryDays, GETDATE()), @ClaimType, @HandledBy);
                ";

                foreach (var cardNo in cardNos)
                {
                    totalCustomers++;
                    // --- LOOP TO ADD MULTIPLE COUPONS ---
                    for (int i = 0; i < request.CouponCount; i++)
                    {
                        await conn.ExecuteAsync(insertSql, new
                        {
                            CardNo = cardNo,
                            Value = request.CouponValue,
                            ExpiryDays = request.ExpiryDays,
                            ClaimType = request.ClaimType,
                            HandledBy = request.HandledBy
                        }, transaction);

                        totalInserts++;
                    }
                }

                await transaction.CommitAsync();
                await _dashboardHub.Clients.All.SendAsync("ReceiveDashboardUpdate", "Bulk coupons added");
                _logger.LogInformation("BULK ADD: {Count} coupons created for {CustCount} customers.", totalInserts, totalCustomers);

                return Ok(new
                {
                    message = $"Successfully created {totalInserts} coupons for {totalCustomers} customers.",
                    count = totalInserts
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "BULK ADD FAILED. Transaction rolled back.");
                return StatusCode(500, new { message = "Bulk add failed due to an internal error." });
            }
        }
        // --- END FIX ---


        // (MergeCustomer is unchanged)
        [Authorize(Roles = "Admin")]
        [HttpPost("merge")]
        public async Task<IActionResult> MergeCustomer([FromBody] MergeRequest request)
        {
            if (string.IsNullOrEmpty(request.SourceCardNo) || string.IsNullOrEmpty(request.TargetCardNo))
            {
                return BadRequest(new { message = "Source and Target Card Numbers are required." });
            }
            if (request.SourceCardNo.Equals(request.TargetCardNo, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Source and Target Card Numbers must be different." });
            }
            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.OpenAsync();
            using var transaction = conn.BeginTransaction();
            int couponsMoved = 0;
            try
            {
                var checkSql = "SELECT COUNT(CardNo) FROM Customers WHERE CardNo IN (@Source, @Target)";
                int existingCount = await conn.ExecuteScalarAsync<int>(checkSql, new { Source = request.SourceCardNo, Target = request.TargetCardNo }, transaction);
                if (existingCount < 2)
                {
                    await transaction.RollbackAsync();
                    return NotFound(new { message = "One or both card numbers do not exist in the Loyalty system." });
                }
                var updateCouponsSql = @"
                    UPDATE Coupons 
                    SET CardNo = @TargetCardNo, 
                        ClaimType = ISNULL(ClaimType, 'System Merge'), 
                        HandledBy = ISNULL(HandledBy, 'System Merge') + ' (Merged by ' + @MergedBy + ')'
                    WHERE CardNo = @SourceCardNo;
                ";
                couponsMoved = await conn.ExecuteAsync(updateCouponsSql, request, transaction);
                var deleteCustomerSql = "DELETE FROM Customers WHERE CardNo = @SourceCardNo;";
                await conn.ExecuteAsync(deleteCustomerSql, request, transaction);
                await transaction.CommitAsync();
                await _dashboardHub.Clients.All.SendAsync("ReceiveDashboardUpdate", "Customer merged");
                _logger.LogInformation("CUSTOMER MERGE: Source {Source} merged into Target {Target}. {Count} coupons moved.", request.SourceCardNo, request.TargetCardNo, couponsMoved);
                return Ok(new
                {
                    message = $"Successfully merged {request.SourceCardNo} into {request.TargetCardNo}. {couponsMoved} coupons transferred.",
                    couponsMoved
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "CUSTOMER MERGE FAILED for Source {Source} and Target {Target}.", request.SourceCardNo, request.TargetCardNo);
                return StatusCode(500, new { message = "Customer merge failed due to a server error." });
            }
        }

        // (VoidCoupon is unchanged)
        [HttpPost("void/{couponId}")]
        public async Task<IActionResult> VoidCoupon(int couponId)
        {
            string? cardNo = null;
            string oldTier = "Bronze";
            string newTier = "Bronze";
            string? warningMessage = null;
            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.OpenAsync();
            using var transaction = conn.BeginTransaction();
            try
            {
                cardNo = await conn.ExecuteScalarAsync<string>(
                    "SELECT CardNo FROM Coupons WHERE CouponID = @CouponID AND Status = 'Redeemed'",
                    new { CouponID = couponId },
                    transaction
                );
                if (string.IsNullOrEmpty(cardNo))
                {
                    await transaction.RollbackAsync();
                    return NotFound(new { message = "Could not find a redeemed coupon with that ID to void." });
                }
                var thresholds = await GetTierThresholds(conn, transaction);
                oldTier = await GetCustomerTier(cardNo, thresholds, conn, transaction);
                var updateSql = @"
                    UPDATE Coupons 
                    SET Status = 'Pending', DateRedeemed = NULL, ClaimType = 'Voided', HandledBy = 'Voided'
                    WHERE CouponID = @CouponID AND Status = 'Redeemed';
                ";
                int rowsAffected = await conn.ExecuteAsync(updateSql, new { CouponID = couponId }, transaction);
                if (rowsAffected == 0)
                {
                    await transaction.RollbackAsync();
                    return NotFound(new { message = "Coupon was not in a 'Redeemed' state." });
                }
                newTier = await GetCustomerTier(cardNo, thresholds, conn, transaction);
                await transaction.CommitAsync();
                await _dashboardHub.Clients.All.SendAsync("ReceiveDashboardUpdate", "Coupon voided");
                if (oldTier != newTier && newTier != "Gold")
                {
                    warningMessage = $"Coupon voided. Be aware: This customer has been downgraded from {oldTier} to {newTier} tier.";
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error during void operation for CouponID {CouponID}", couponId);
                return StatusCode(500, new { message = "An error occurred while voiding the coupon." });
            }
            return Ok(new
            {
                message = "Coupon has been voided and is now pending again.",
                tierWarning = warningMessage
            });
        }
    }
}