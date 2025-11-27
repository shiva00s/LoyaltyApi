using Dapper;
using LoyaltyAPI.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using System.Data; // <-- ADDED: For Stored Procedure

namespace LoyaltyAPI.Controllers
{
    // --- ADD THIS NEW MODEL ---
    public class CustomerPerformanceViewModel
    {
        public required string CName { get; set; }
        public required string CardNo { get; set; }
        public required string CContact { get; set; }
        public required string Tier { get; set; }
        public int TotalCouponsEarned { get; set; }
        public int TotalCouponsRedeemed { get; set; }
        public decimal TotalValueRedeemed { get; set; }
        public double BalancePoints { get; set; }
    }
    // --- Model for existing reports ---
    public class DetailedReportItem
    {
        public int? CouponID { get; set; } // Made nullable for history
        public string? CContact { get; set; }
        public int? Count { get; set; } // Made nullable
        public string? CardNo { get; set; }
        public string? CName { get; set; }
        public decimal? Value { get; set; } // Made nullable
        public string? Status { get; set; }
        public string? ClaimType { get; set; }
        public string? HandledBy { get; set; }
        public DateTime? DateCreated { get; set; } // Made nullable
        public DateTime? DateRedeemed { get; set; }
        public int? GiftCount { get; set; } // Made nullable
        public int? PurchaseCount { get; set; } // Made nullable
    }

    // --- NEW: Model for the paginated search response ---
    public class PaginatedReportResult
    {
        public List<DetailedReportItem> Items { get; set; } = new List<DetailedReportItem>();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
    }

    // --- Model for Staff Performance ---
    public class StaffPerformanceViewModel
    {
        public string? HandledBy { get; set; }
        public int ManualCouponsCreated { get; set; }
        public int CouponsRedeemed { get; set; }
        public decimal ValueRedeemed { get; set; }
        public int RedeemedAsGift { get; set; }
        public int RedeemedAsPurchase { get; set; }
    }

    // --- Model for Tier Summary Report ---
    public class TierSummaryViewModel
    {
        public required string Tier { get; set; }
        public int CustomerCount { get; set; }
        public decimal TotalPendingValue { get; set; }
        public int TotalPendingCount { get; set; }
        public decimal TotalRedeemedValue { get; set; }
        public int TotalRedeemedCount { get; set; }
    }

    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ReportController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;
        private readonly string? _billnusDbConnection;
        private readonly ILogger<ReportController> _logger;

        // --- UPDATED: Logger is now injected ---
        public ReportController(IConfiguration config, ILogger<ReportController> logger)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _billnusDbConnection = config.GetConnectionString("BillnusBP_DB");
            _logger = logger;
        }

        // --- REMOVED: GetTierThresholds helper (now inside sp_GetTierSummary) ---

        [HttpGet("customerhistory")]
        public async Task<IActionResult> GetCustomerHistory([FromQuery] string identifier)
        {
            // --- UPDATED: Call Stored Procedure ---
            try
            {
                using (var loyaltyConn = new SqlConnection(_loyaltyDbConnection))
                {
                    var reportData = await loyaltyConn.QueryAsync<DetailedReportItem>(
                        "dbo.sp_GetCustomerHistory",
                        new { Identifier = identifier },
                        commandType: CommandType.StoredProcedure
                    );

                    if (!reportData.Any() || reportData.First().CouponID == null)
                    {
                        return NotFound(new { message = "Customer not found with that Card No or Mobile Number." });
                    }

                    return Ok(reportData);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing sp_GetCustomerHistory for identifier {Identifier}", identifier);
                return StatusCode(500, new { message = "An error occurred while fetching customer history." });
            }
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchCoupons(
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate,
            [FromQuery] string? identifier,
            [FromQuery] string status = "all",
            [FromQuery] string claimType = "all",
            [FromQuery] string handledBy = "all",
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 100)
        {
            // --- UPDATED: Call Stored Procedure ---
            var result = new PaginatedReportResult
            {
                PageNumber = pageNumber,
                PageSize = pageSize
            };

            try
            {
                using (var conn = new SqlConnection(_loyaltyDbConnection))
                {
                    var parameters = new
                    {
                        startDate = startDate.Date,
                        endDate = endDate.Date.AddDays(1), // Use exclusive end date
                        identifier = string.IsNullOrEmpty(identifier) ? null : $"%{identifier}%",
                        status,
                        claimType,
                        handledBy,
                        pageNumber,
                        pageSize
                    };

                    var queryResult = await conn.QueryAsync(
                        "dbo.sp_SearchCoupons",
                        parameters,
                        commandType: CommandType.StoredProcedure
                    );

                    if (queryResult.Any())
                    {
                        result.TotalCount = queryResult.First().TotalCount;
                        result.Items = queryResult.Select(item => new DetailedReportItem
                        {
                            CardNo = item.CardNo,
                            CName = item.CName,
                            CContact = item.CContact,
                            Status = item.Status,
                            Value = item.Value,
                            Count = item.Count,
                            HandledBy = item.HandledBy,
                            DateCreated = item.DateCreated,
                            DateRedeemed = item.DateRedeemed,
                            GiftCount = item.GiftCount,
                            PurchaseCount = item.PurchaseCount
                        }).ToList();
                    }
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing sp_SearchCoupons query.");
                return StatusCode(500, new { message = $"Database error: {ex.Message}" });
            }
        }

        [HttpGet("staff-performance")]
        public async Task<IActionResult> GetStaffPerformance([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            // --- UPDATED: Call Stored Procedure ---
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                var rawData = await conn.QueryAsync(
                    "dbo.sp_GetStaffPerformance",
                    new
                    {
                        startDate = startDate.Date,
                        endDate = endDate.Date.AddDays(1) // Use exclusive end date
                    },
                    commandType: CommandType.StoredProcedure
                );

                // C# LINQ aggregation is still the best way to do this part
                var result = rawData
                    .GroupBy(r => (string)r.HandledBy)
                    .Select(g => new StaffPerformanceViewModel
                    {
                        HandledBy = g.Key,
                        CouponsRedeemed = g.Sum(r => (int)r.IsRedeemed),
                        ManualCouponsCreated = g.Sum(r => (int)r.IsManualCreate),
                        ValueRedeemed = g.Where(r => r.Status == "Redeemed").Sum(r => (decimal)r.Value),
                        RedeemedAsGift = g.Sum(r => (int)r.IsGiftRedeem),
                        RedeemedAsPurchase = g.Sum(r => (int)r.IsPurchaseRedeem)
                    })
                    .OrderByDescending(s => s.CouponsRedeemed)
                    .ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing sp_GetStaffPerformance query.");
                return StatusCode(500, new { message = $"Database error: {ex.Message}" });
            }
        }

        [HttpGet("tier-summary")]
        public async Task<IActionResult> GetTierSummary()
        {
            // --- UPDATED: Call Stored Procedure ---
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                var result = await conn.QueryAsync<TierSummaryViewModel>(
                    "dbo.sp_GetTierSummary",
                    commandType: CommandType.StoredProcedure
                );
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing sp_GetTierSummary query.");
                return StatusCode(500, new { message = $"Database error: {ex.Message}" });
            }
        }

        // --- ADD THIS NEW ENDPOINT ---
        [HttpGet("customer-performance")]
        public async Task<IActionResult> GetCustomerPerformanceReport()
        {
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                var result = await conn.QueryAsync<CustomerPerformanceViewModel>(
                    "dbo.sp_GetCustomerPerformanceReport",
                    commandType: CommandType.StoredProcedure
                );
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing sp_GetCustomerPerformanceReport query.");
                return StatusCode(500, new { message = $"Database error: {ex.Message}" });
            }
        }
    }
}