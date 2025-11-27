using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration; // Added
using Microsoft.Extensions.Logging; // Added
using System; // Added
using System.Collections.Generic;
using System.Threading.Tasks;

namespace LoyaltyAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StaffController : ControllerBase
    {
        // --- THIS IS THE FIX ---
        // Changed connection string to LoyaltyDB
        private readonly string? _loyaltyDbConnection;
        // --- END OF FIX ---
        private readonly ILogger<StaffController> _logger;

        public StaffController(IConfiguration config, ILogger<StaffController> logger)
        {
            // --- THIS IS THE FIX ---
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB"); // Use LoyaltyDB
            // --- END OF FIX ---
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetStaffList()
        {
            // --- THIS IS THE FIX ---
            // Only select staff who are marked as active
            var sql = @"
                SELECT StaffName
                FROM [LoyaltyDB].[dbo].[Staff]
                WHERE IsActive = 1
                ORDER BY StaffName;
            ";
            // --- END OF FIX ---

            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection); // Use LoyaltyDB connection
                var staffNames = await conn.QueryAsync<string>(sql);
                return Ok(staffNames);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get staff list from LoyaltyDB.");
                return StatusCode(500, new { message = "Could not fetch staff list." });
            }
        }
    }
}