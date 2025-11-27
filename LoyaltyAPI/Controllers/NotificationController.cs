using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;

namespace LoyaltyAPI.Controllers
{
    // This model will be used to send the notification data
    public class Notification
    {
        public int NotificationID { get; set; }
        public required string Message { get; set; }
        public DateTime DateCreated { get; set; }
    }

    [Authorize] // Secure the endpoint
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;

        public NotificationController(IConfiguration config)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
        }

        // This creates the GET: api/notification endpoint
        [HttpGet]
        public async Task<IActionResult> GetNotifications()
        {
            // Get the top 20 most recent notifications
            var sql = @"
                    SELECT NotificationID, Message, DateCreated
                    FROM [LoyaltyDB].[dbo].[Notifications]
                    WHERE DateCreated >= CAST(GETDATE() AS DATE)
                    ORDER BY DateCreated DESC";

            using var conn = new SqlConnection(_loyaltyDbConnection);
            try
            {
                var notifications = await conn.QueryAsync<Notification>(sql);
                return Ok(notifications);
            }
            catch (System.Exception)
            {
                // You can add logging here
                return StatusCode(500, new { message = "Database error fetching notifications." });
            }
        }
    }
}