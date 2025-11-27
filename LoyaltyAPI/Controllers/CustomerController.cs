using Dapper;
using LoyaltyAPI.Models;
using LoyaltyAPI.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using System.Data;
using Microsoft.AspNetCore.SignalR; // Added for Hub
using LoyaltyAPI.Hubs; // Added for Hub

namespace LoyaltyAPI.Controllers
{
    // --- RedemptionReceiptViewModel and other helpers remain unchanged here ---
    public class RedemptionReceiptViewModel
    {
        public required string CustomerName { get; set; }
        public required string CardNo { get; set; }
        public required List<RedemptionItem> Items { get; set; }
        public required string HandledBy { get; set; }
        public decimal TotalValueRedeemed { get; set; }
        public int TotalCouponsRedeemed { get; set; }
        public DateTime RedemptionDate { get; set; }
    }

    // --- ADDED THESE NEW CLASSES ---
    public class ShopSettingsViewModel
    {
        public bool PrintShopHeader { get; set; }
        public required string ShopName { get; set; }
        public required string ShopAddress { get; set; }
        public required string ShopContact { get; set; }
    }

    public class RedemptionResponse
    {
        public required RedemptionReceiptViewModel Receipt { get; set; }
        public required ShopSettingsViewModel ShopSettings { get; set; }
    }
    // --- END NEW CLASSES ---


    public class CustomerSuggestion
    {
        public string? CardNo { get; set; }
        public string? CName { get; set; }
        public string? CContact { get; set; }
    }


    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class CustomerController : ControllerBase
    {
        private readonly string? _billnusDbConnection;
        private readonly string? _loyaltyDbConnection;
        private readonly ILogger<CustomerController> _logger;
        private readonly IConfiguration _config;
        private readonly ISettingsService _settingsService;
        private readonly IPrinterService _printerService;
        private readonly IHubContext<DashboardHub> _dashboardHub;

        public CustomerController(
            IConfiguration config,
            ILogger<CustomerController> logger,
            ISettingsService settingsService,
            IPrinterService printerService,
            IHubContext<DashboardHub> dashboardHub)
        {
            _billnusDbConnection = config.GetConnectionString("BillnusBP_DB");
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _logger = logger;
            _config = config;
            _settingsService = settingsService;
            _printerService = printerService;
            _dashboardHub = dashboardHub;
        }


        // --- GetCustomerSuggestions (UPDATED with Blacklist) ---
        [HttpGet("autocomplete")]
        public async Task<IActionResult> GetCustomerSuggestions([FromQuery] string query)
        {
            if (string.IsNullOrEmpty(query) || query.Length < 2)
            {
                return Ok(new List<CustomerSuggestion>());
            }
            if (string.IsNullOrEmpty(_loyaltyDbConnection))
            {
                _logger.LogError("Autocomplete failed: LoyaltyDB connection string is null.");
                return StatusCode(500, new { message = "Server configuration error: LoyaltyDB connection missing." });
            }

            // --- BLACKLIST FIX ---
            // The query now JOINS against the blacklist and excludes blacklisted customers
            var sql = @"
                SELECT TOP 10 c.CardNo, c.CName, c.CContact
                FROM [LoyaltyDB].[dbo].[Customers] c
                LEFT JOIN [LoyaltyDB].[dbo].[CustomerBlacklist] b ON c.CardNo = b.CardNo
                WHERE 
                    b.CardNo IS NULL AND (
                        ISNULL(c.CName, '') LIKE @searchTerm
                        OR ISNULL(c.CardNo, '') LIKE @searchTerm
                        OR ISNULL(c.CContact, '') LIKE @searchTerm
                    )";
            // --- END FIX ---

            var searchTerm = $"%{query}%";
            try
            {
                using (var conn = new SqlConnection(_loyaltyDbConnection))
                {
                    var suggestions = await conn.QueryAsync<CustomerSuggestion>(sql,
                        new { searchTerm = searchTerm });
                    return Ok(suggestions);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Database error during customer autocomplete search.");
                return StatusCode(500, new { message = "An internal database error occurred during search." });
            }
        }


        // --- GetCustomerDetails (UPDATED with Blacklist) ---
        [HttpGet("{cardNo}")]
        public async Task<IActionResult> GetCustomerDetails(string cardNo)
        {
            try
            {
                using (var conn = new SqlConnection(_loyaltyDbConnection))
                {
                    await conn.OpenAsync();

                    // --- BLACKLIST FIX ---
                    // Check blacklist table first
                    var blacklistCheckSql = "SELECT COUNT(1) FROM [dbo].[CustomerBlacklist] WHERE CardNo = @CardNo";
                    bool isBlacklisted = await conn.ExecuteScalarAsync<bool>(blacklistCheckSql, new { CardNo = cardNo });

                    if (isBlacklisted)
                    {
                        _logger.LogWarning("Blocked attempt to view details for blacklisted customer: {CardNo}", cardNo);
                        return StatusCode(403, new { message = "This customer is blacklisted and cannot be accessed." });
                    }
                    // --- END FIX ---

                    using (var reader = await conn.ExecuteReaderAsync(
                        "dbo.sp_GetCustomerDetails",
                        new { CardNo = cardNo },
                        commandType: CommandType.StoredProcedure))
                    {
                        CustomerViewModel? customerViewModel = null;
                        if (await reader.ReadAsync())
                        {
                            // ... (rest of the method is unchanged) ...
                            customerViewModel = new CustomerViewModel
                            {
                                CardNo = reader.GetString(reader.GetOrdinal("CardNo")),
                                CName = reader.GetString(reader.GetOrdinal("CName")),
                                CContact = reader.IsDBNull(reader.GetOrdinal("CContact"))
                                           ? null
                                           : reader.GetString(reader.GetOrdinal("CContact")),
                                CurrentPoints = reader.GetDouble(reader.GetOrdinal("CurrentPoints")),
                                AvailableCoupons = reader.GetInt32(reader.GetOrdinal("AvailableCoupons")),
                                Tier = reader.GetString(reader.GetOrdinal("Tier"))
                            };
                        }

                        if (customerViewModel == null)
                        {
                            _logger.LogWarning($"sp_GetCustomerDetails returned no data for CardNo: {cardNo}");
                            return NotFound(new { message = "Customer not found." });
                        }

                        await reader.NextResultAsync();
                        var pendingCoupons = new List<PendingCoupon>();
                        while (await reader.ReadAsync())
                        {
                            pendingCoupons.Add(new PendingCoupon
                            {
                                CouponID = reader.GetInt32(reader.GetOrdinal("CouponID")),
                                Value = reader.GetDecimal(reader.GetOrdinal("Value")),
                                ExpiryDate = reader.IsDBNull(reader.GetOrdinal("ExpiryDate"))
                                             ? (DateTime?)null
                                             : reader.GetDateTime(reader.GetOrdinal("ExpiryDate"))
                            });
                        }
                        customerViewModel.PendingCoupons = pendingCoupons;

                        return Ok(customerViewModel);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error executing sp_GetCustomerDetails for CardNo {cardNo}");
                return StatusCode(500, new { message = "An internal server error occurred while fetching customer details." });
            }
        }


        // --- RedeemCoupons (UPDATED with Blacklist) ---
        [HttpPost("{cardNo}/redeem")]
        public async Task<IActionResult> RedeemCoupons(string cardNo, [FromBody] RedeemRequest request)
        {
            if (request.Items == null || !request.Items.Any() || request.Items.Any(i => i.Count <= 0))
            {
                return BadRequest(new { message = "Redemption list is invalid. Please add items." });
            }

            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.OpenAsync();

            // --- BLACKLIST FIX ---
            // Check blacklist table first
            var blacklistCheckSql = "SELECT COUNT(1) FROM [dbo].[CustomerBlacklist] WHERE CardNo = @CardNo";
            bool isBlacklisted = await conn.ExecuteScalarAsync<bool>(blacklistCheckSql, new { CardNo = cardNo });

            if (isBlacklisted)
            {
                _logger.LogWarning("Blocked redemption attempt for blacklisted customer: {CardNo}", cardNo);
                return StatusCode(403, new { message = "Redemption failed: This customer is blacklisted." });
            }
            // --- END FIX ---

            var shopSettings = await GetShopSettingsAsync();
            var printMode = shopSettings.GetValueOrDefault("PrintMode", "Preview");
            var printerName = shopSettings.GetValueOrDefault("PrinterName", "RP3150");

            var updateSql = @"
                UPDATE [LoyaltyDB].[dbo].[Coupons]
                SET Status = 'Redeemed', DateRedeemed = GETDATE(), ClaimType = @ClaimType, HandledBy = @HandledBy
                OUTPUT INSERTED.Value
                WHERE CouponID IN (
                    SELECT TOP (@Count) CouponID
                    FROM [LoyaltyDB].[dbo].[Coupons]
                    WHERE CardNo = @CardNo AND Status = 'Pending'
                    ORDER BY ExpiryDate ASC, DateCreated ASC
                );";

            using var transaction = conn.BeginTransaction();
            int totalCouponsRedeemed = 0;
            decimal totalValueRedeemed = 0;

            try
            {
                int totalCouponsRequested = request.Items.Sum(i => i.Count);
                var availableCouponsSql = "SELECT COUNT(*) FROM [LoyaltyDB].[dbo].[Coupons] WHERE CardNo = @CardNo AND Status = 'Pending'";
                int availableCount = await conn.ExecuteScalarAsync<int>(availableCouponsSql, new { CardNo = cardNo }, transaction);

                if (totalCouponsRequested > availableCount)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = $"Failed: You requested {totalCouponsRequested} coupons, but only {availableCount} are available." });
                }

                foreach (var item in request.Items)
                {
                    var redeemedValues = await conn.QueryAsync<decimal>(updateSql, new { CardNo = cardNo, Count = item.Count, ClaimType = item.ClaimType, HandledBy = request.HandledBy }, transaction);
                    int rowsAffected = redeemedValues.Count();
                    if (rowsAffected < item.Count)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = $"Failed: Not enough pending coupons for item '{item.ClaimType}'." });
                    }
                    totalCouponsRedeemed += rowsAffected;
                    totalValueRedeemed += redeemedValues.Sum();
                }

                await transaction.CommitAsync();

                // Trigger instant dashboard refresh
                //using (var updateConn = new SqlConnection(_loyaltyDbConnection))
                //{
                 //   await updateConn.ExecuteAsync("dbo.sp_UpdateDashboardSummary", commandType: CommandType.StoredProcedure);
                //}
                await _dashboardHub.Clients.All.SendAsync("ReceiveDashboardUpdate", "Redemption processed");

                _logger.LogInformation($"Redemption successful for {cardNo}: {totalCouponsRedeemed} coupons redeemed by {request.HandledBy} for {totalValueRedeemed} rs.");

                // ... (rest of the method is unchanged) ...
                string customerName = "N/A";
                try
                {
                    customerName = await conn.ExecuteScalarAsync<string>("SELECT CName FROM Customers WHERE CardNo = @CardNo", new { CardNo = cardNo }) ?? "N/A";
                    if (customerName == "N/A")
                    {
                        using (var billnusConn = new SqlConnection(_billnusDbConnection))
                        {
                            customerName = await billnusConn.ExecuteScalarAsync<string>("SELECT CName FROM [BillnusBP].[dbo].[Customer_Entry] WHERE CardNo = @CardNo", new { CardNo = cardNo }) ?? "N/A";
                        }
                    }
                }
                catch (Exception getCustomerEx)
                {
                    _logger.LogError(getCustomerEx, $"Redemption SAVED for {cardNo}, but failed to get customer name for receipt.");
                }

                var receipt = new RedemptionReceiptViewModel
                {
                    CustomerName = customerName,
                    CardNo = cardNo,
                    Items = request.Items,
                    HandledBy = request.HandledBy,
                    TotalValueRedeemed = totalValueRedeemed,
                    TotalCouponsRedeemed = totalCouponsRedeemed,
                    RedemptionDate = DateTime.Now
                };

                if (printMode == "Raw")
                {
                    try
                    {

                        await _printerService.PrintReceiptAsync(
                          printerName,
                          "COUPON REDEMPTION",
                          receipt,
                          shopSettings.GetValueOrDefault("Feature_PrintShopHeader", "False") == "True",
                          shopSettings.GetValueOrDefault("Shop_Name"),
                          shopSettings.GetValueOrDefault("Shop_Address"),
                          shopSettings.GetValueOrDefault("Shop_Contact")
                        );

                        _logger.LogInformation($"Receipt print job sent via service for {cardNo}.");
                        return Ok(receipt);
                    }
                    catch (Exception printEx)
                    {
                        _logger.LogError(printEx, $"Redemption SAVED for {cardNo}, but RAW printing via service FAILED.");
                        // --- THIS IS THE FIX ---
                        // Return a 500 status to explicitly tell the client the print failed.
                        return StatusCode(500, new
                        {
                            message = "Redemption processed, but receipt printing failed.",
                            receipt
                        });
                        // --- END FIX ---
                    }
                }
                else
                {
                    var settingsForPreview = new ShopSettingsViewModel
                    {
                        PrintShopHeader = shopSettings.GetValueOrDefault("Feature_PrintShopHeader", "False") == "True",
                        ShopName = shopSettings.GetValueOrDefault("Shop_Name"),
                        ShopAddress = shopSettings.GetValueOrDefault("Shop_Address"),
                        ShopContact = shopSettings.GetValueOrDefault("Shop_Contact")
                    };

                    var response = new RedemptionResponse
                    {
                        Receipt = receipt,
                        ShopSettings = settingsForPreview
                    };

                    return Ok(response);
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Critical error in RedeemCoupons for {cardNo}. Transaction rolled back.");
                return StatusCode(500, new { message = "An error occurred: " + ex.Message });
            }
        }


        // POST /api/customer/test-print
        [Authorize(Roles = "Admin")]
        [HttpPost("test-print")]
        public async Task<IActionResult> TestPrint([FromBody] TestPrintRequest request)
        {
            if (string.IsNullOrEmpty(request.PrinterName))
            {
                return BadRequest(new { message = "PrinterName is required." });
            }

            // --- FIX: Fetch actual shop settings, including PrintMode and PrinterName ---
            var shopSettings = await GetShopSettingsAsync();
            var printerName = shopSettings.GetValueOrDefault("PrinterName", request.PrinterName); // Use setting, fallback to request
            // --- END FIX ---

            try
            {
                var receipt = new RedemptionReceiptViewModel
                {
                    CustomerName = "Test Customer",
                    CardNo = "123456789",
                    Items = new List<RedemptionItem> { new RedemptionItem { Count = 1, ClaimType = "Test Item" } },
                    HandledBy = User.Identity?.Name ?? "Admin",
                    TotalValueRedeemed = 100,
                    TotalCouponsRedeemed = 1,
                    RedemptionDate = DateTime.Now
                };

                // Pass the necessary parameters to the print service
                await _printerService.PrintReceiptAsync(
                    printerName, // Use the fetched printer name
                    "--- TEST PRINT ---",
                    receipt,
                    // Use mock data for the test header, but ensure boolean is passed
                    true,
                    shopSettings.GetValueOrDefault("Shop_Name", "Your Shop Name (TEST)"),
                    shopSettings.GetValueOrDefault("Shop_Address", "123 Test Address, City"),
                    shopSettings.GetValueOrDefault("Shop_Contact", "Ph: 555-TEST")
                );

                _logger.LogInformation($"Test print sent via service to {request.PrinterName} successfully.");
                return Ok(new { message = "Test print sent successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Test print via service to {request.PrinterName} FAILED.");
                return StatusCode(500, new { message = $"Test print failed: {ex.Message}" });
            }
        }

        public class TestPrintRequest
        {
            public string? PrinterName { get; set; }
        }

        // --- GetShopSettingsAsync (Unchanged) ---
        private async Task<Dictionary<string, string>> GetShopSettingsAsync()
        {
            using var conn = new SqlConnection(_loyaltyDbConnection);
            var settingsList = await conn.QueryAsync<(string Key, string Value)>(
                @"SELECT SettingKey, SettingValue FROM Settings 
                  WHERE SettingKey IN (
                      'PrintMode', 
                      'PrinterName',
                      'Feature_PrintShopHeader',
                      'Shop_Name',
                      'Shop_Address',
                      'Shop_Contact'
                  )"
            );
            return settingsList.ToDictionary(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase);
        }
    }
}