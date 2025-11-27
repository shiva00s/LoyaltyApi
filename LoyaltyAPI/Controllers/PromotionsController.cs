using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
namespace LoyaltyAPI.Controllers
{
    // --- NEW: Model for a Promotion ---
    public class Promotion
    {
        public int PromotionID { get; set; }
        public required string Name { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal CouponValue { get; set; }
        public bool IsEnabled { get; set; }
    }
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class PromotionsController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;

        public PromotionsController(IConfiguration config)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
        }

        // GET: api/promotions
        [HttpGet]
        public async Task<IActionResult> GetPromotions()
        {
            // The error is likely happening here
            var sql = "SELECT * FROM Promotions ORDER BY StartDate DESC";
            using var conn = new SqlConnection(_loyaltyDbConnection);

            try
            {
                var promotions = await conn.QueryAsync<Promotion>(sql);
                return Ok(promotions); // Should return successful JSON
            }
            catch (Exception)
            {
                // If an exception occurs, the server might send a blank 500 response, causing the JSON error.
                // Check logs for the details of 'ex'.
                return StatusCode(500, new { message = "Database Error Fetching Promotions." });
            }
        }

        // POST: api/promotions
        [HttpPost]
        public async Task<IActionResult> CreatePromotion([FromBody] Promotion promotion)
        {
            // Ensure end date is after start date
            if (promotion.EndDate <= promotion.StartDate)
            {
                return BadRequest(new { message = "End Date must be after Start Date." });
            }

            var sql = @"
                INSERT INTO Promotions(Name, StartDate, EndDate, CouponValue, IsEnabled)
                VALUES(@Name, @StartDate, @EndDate, @CouponValue, @IsEnabled);
            ";
            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.ExecuteAsync(sql, promotion);
            return Ok(new { message = "Promotion created successfully." });
        }

        // PUT: api/promotions/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePromotion(int id, [FromBody] Promotion promotion)
        {
            if (id != promotion.PromotionID)
            {
                return BadRequest(new { message = "Promotion ID mismatch." });
            }

            if (promotion.EndDate <= promotion.StartDate)
            {
                return BadRequest(new { message = "End Date must be after Start Date." });
            }

            var sql = @"
                UPDATE Promotions SET
                    Name = @Name,
                    StartDate = @StartDate,
                    EndDate = @EndDate,
                    CouponValue = @CouponValue,
                    IsEnabled = @IsEnabled
                WHERE PromotionID = @PromotionID;
            ";
            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.ExecuteAsync(sql, promotion);
            return Ok(new { message = "Promotion updated successfully." });
        }

        // DELETE: api/promotions/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePromotion(int id)
        {
            var sql = "DELETE FROM Promotions WHERE PromotionID = @PromotionID";
            using var conn = new SqlConnection(_loyaltyDbConnection);
            await conn.ExecuteAsync(sql, new { PromotionID = id });
            return Ok(new { message = "Promotion deleted successfully." });
        }
    }
}