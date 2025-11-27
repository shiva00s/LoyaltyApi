using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace LoyaltyAPI.Controllers
{
    // This model is for this controller only
    public class StaffManagementViewModel
    {
        public int StaffID { get; set; }
        public required string StaffName { get; set; }
        public bool IsActive { get; set; }
    }

    [Authorize(Roles = "Admin")] // Only Admins can access this
    [Route("api/[controller]")]
    [ApiController]
    public class StaffManagementController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;
        private readonly ILogger<StaffManagementController> _logger;

        public StaffManagementController(IConfiguration config, ILogger<StaffManagementController> logger)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _logger = logger;
        }

        // GET: api/staffmanagement
        [HttpGet]
        public async Task<IActionResult> GetAllStaff()
        {
            var sql = "SELECT StaffID, StaffName, IsActive FROM [dbo].[Staff] ORDER BY StaffName";
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                var staff = await conn.QueryAsync<StaffManagementViewModel>(sql);
                return Ok(staff);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get full staff list for management.");
                return StatusCode(500, new { message = "Database error fetching staff list." });
            }
        }

        // PUT: api/staffmanagement/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateStaffStatus(int id, [FromBody] StaffManagementViewModel staffMember)
        {
            if (id != staffMember.StaffID)
            {
                return BadRequest(new { message = "Staff ID mismatch." });
            }

            var sql = "UPDATE [dbo].[Staff] SET IsActive = @IsActive WHERE StaffID = @StaffID";
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                int rowsAffected = await conn.ExecuteAsync(sql, new { staffMember.IsActive, staffMember.StaffID });

                if (rowsAffected == 0)
                {
                    return NotFound(new { message = "Staff member not found." });
                }

                _logger.LogInformation("Staff {StaffName} (ID: {StaffID}) status updated to {IsActive}", staffMember.StaffName, staffMember.StaffID, staffMember.IsActive);
                return Ok(new { message = "Staff status updated successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update staff status for StaffID {StaffID}", staffMember.StaffID);
                return StatusCode(500, new { message = "Database error updating staff member." });
            }
        }
    }
}