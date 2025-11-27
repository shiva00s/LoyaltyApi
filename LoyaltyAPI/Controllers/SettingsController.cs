using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using System;
using System.Data; // Required for StoredProcedure

namespace LoyaltyAPI.Controllers
{
    [Authorize(Roles = "Admin")]
    [Route("api/[controller]")]
    [ApiController]
    public class SettingsController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;
        // We still need to inject this, even if we don't use it in this method
        private readonly string? _billnusDbConnection;
        private readonly ILogger<SettingsController> _logger;

        public SettingsController(IConfiguration config, ILogger<SettingsController> logger)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _billnusDbConnection = config.GetConnectionString("BillnusBP_DB");
            _logger = logger;
        }

        public class Setting
        {
            public required string SettingKey { get; set; }
            public required string SettingValue { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            using var conn = new SqlConnection(_loyaltyDbConnection);
            var settings = await conn.QueryAsync<Setting>("SELECT SettingKey, SettingValue FROM Settings");
            return Ok(settings);
        }

        [HttpPut]
        public async Task<IActionResult> UpdateSettings([FromBody] List<Setting> settings)
        {
            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.OpenAsync();
            using var transaction = conn.BeginTransaction();

            var sql = @"
                MERGE INTO Settings AS target
                USING (SELECT @SettingKey AS SettingKey, @SettingValue AS SettingValue) AS source
                ON (target.SettingKey = source.SettingKey)
                WHEN MATCHED THEN
                    UPDATE SET SettingValue = source.SettingValue
                WHEN NOT MATCHED THEN
                    INSERT (SettingKey, SettingValue)
                    VALUES (source.SettingKey, source.SettingValue);
            ";

            foreach (var setting in settings)
            {
                await conn.ExecuteAsync(sql, setting, transaction);
            }
            transaction.Commit();
            return Ok(new { message = "Settings updated successfully." });
        }

        // ---
        // --- MASTER RESET (FIXED) ---
        // ---
        [HttpPost("master-reset")]
        public async Task<IActionResult> MasterReset()
        {
            _logger.LogWarning("--- MASTER RESET INITIATED BY USER {User} ---", User.Identity?.Name);

            try
            {
                // 1. Reset LoyaltyDB by calling the stored procedure
                using (var conn = new SqlConnection(_loyaltyDbConnection))
                {
                    // This is line 83. It calls the sp_MasterReset procedure.
                    await conn.ExecuteAsync("dbo.sp_MasterReset", commandType: System.Data.CommandType.StoredProcedure);
                }
                _logger.LogInformation("LoyaltyDB has been reset.");

                // --- FIX ---
                // The block of code that tried to update BillnusBP
                // has been removed as you requested.
                // --- END FIX ---

                return Ok(new { message = "Master Reset Successful. All test data has been cleared from LoyaltyDB." });
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex, "--- MASTER RESET FAILED ---");
                return StatusCode(500, new { message = "A critical error occurred during the master reset. Check API logs." });
            }
        }

    }
}