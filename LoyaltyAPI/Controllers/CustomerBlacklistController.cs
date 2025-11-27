using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace LoyaltyAPI.Controllers
{
    // Model for this controller's GET request
    public class BlacklistedCustomer
    {
        public required string CardNo { get; set; }
        public required string CName { get; set; }
        public required string CContact { get; set; }
    }

    // Model for this controller's POST request
    public class BlacklistAddRequest
    {
        public required string CardNo { get; set; }
    }


    [Authorize(Roles = "Admin")] // Only Admins can access this
    [Route("api/[controller]")]
    [ApiController]
    public class CustomerBlacklistController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;
        private readonly ILogger<CustomerBlacklistController> _logger;

        public CustomerBlacklistController(IConfiguration config, ILogger<CustomerBlacklistController> logger)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _logger = logger;
        }

        // GET: api/customerblacklist
        // Gets the list of all currently blacklisted customers
        [HttpGet]
        public async Task<IActionResult> GetBlacklistedCustomers()
        {
            // Join with Customers table to get their names
            var sql = @"
                SELECT b.CardNo, c.CName, c.CContact
                FROM [dbo].[CustomerBlacklist] b
                LEFT JOIN [dbo].[Customers] c ON b.CardNo = c.CardNo
                ORDER BY c.CName, b.CardNo";

            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                var list = await conn.QueryAsync<BlacklistedCustomer>(sql);
                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get blacklisted customers.");
                return StatusCode(500, new { message = "Database error fetching blacklist." });
            }
        }

        // POST: api/customerblacklist
        // Adds a new customer to the blacklist
        [HttpPost]
        public async Task<IActionResult> AddToBlacklist([FromBody] BlacklistAddRequest request)
        {
            if (string.IsNullOrEmpty(request?.CardNo))
            {
                return BadRequest(new { message = "CardNo is required." });
            }

            // Use "MERGE" to avoid errors if the card is already in the list
            var sql = @"
                MERGE INTO [dbo].[CustomerBlacklist] AS Target
                USING (SELECT @CardNo AS CardNo) AS Source
                ON (Target.CardNo = Source.CardNo)
                WHEN NOT MATCHED BY TARGET THEN
                    INSERT (CardNo) VALUES (Source.CardNo);";

            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                await conn.ExecuteAsync(sql, new { request.CardNo });
                _logger.LogInformation("Customer {CardNo} added to blacklist.", request.CardNo);
                return Ok(new { message = "Customer blacklisted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to add {CardNo} to blacklist.", request.CardNo);
                return StatusCode(500, new { message = "Database error adding to blacklist." });
            }
        }

        // DELETE: api/customerblacklist/{cardNo}
        // Removes a customer from the blacklist (re-enables them)
        [HttpDelete("{cardNo}")]
        public async Task<IActionResult> RemoveFromBlacklist(string cardNo)
        {
            var sql = "DELETE FROM [dbo].[CustomerBlacklist] WHERE CardNo = @CardNo";
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                int rowsAffected = await conn.ExecuteAsync(sql, new { CardNo = cardNo });

                if (rowsAffected == 0)
                {
                    return NotFound(new { message = "Customer was not found in the blacklist." });
                }

                _logger.LogInformation("Customer {CardNo} removed from blacklist.", cardNo);
                return Ok(new { message = "Customer re-enabled successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to remove {CardNo} from blacklist.", cardNo);
                return StatusCode(500, new { message = "Database error removing from blacklist." });
            }
        }
    }
}