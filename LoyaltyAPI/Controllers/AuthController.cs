using BCrypt.Net;
using Dapper;
using LoyaltyAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel.DataAnnotations; // <-- FIX: ADDED for [Required]

namespace LoyaltyAPI.Controllers
{
    [AllowAnonymous]
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly string? _loyaltyDbConnection;
        private readonly IConfiguration _config;
        private readonly ILogger<AuthController> _logger;
        private readonly string _securityKey;

        public AuthController(IConfiguration config, ILogger<AuthController> logger)
        {
            _loyaltyDbConnection = config.GetConnectionString("LoyaltyDB");
            _config = config;
            _logger = logger;

            // --- SECURITY FIX: Load key from config ---

            _securityKey = _config.GetValue<string>("SecurityKey");

            if (string.IsNullOrEmpty(_securityKey) || _securityKey.Length < 32)
            {
                var errorMsg = "CRITICAL: 'SecurityKey' is missing or too short (must be 32+ chars).";
                _logger.LogCritical(errorMsg);
                throw new ArgumentException(errorMsg, "SecurityKey");
            }
            // --- END SECURITY FIX ---
        }

        // POST: api/Auth/register
        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            string role = "Staff";
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            var sql = @"
                INSERT INTO Users (Username, PasswordHash, Role, StaffName, IsActive, ThemePreference)
                OUTPUT INSERTED.UserID
                VALUES (@Username, @PasswordHash, @Role, @StaffName, 1, 'dark')"; // Default to dark

            using var conn = new SqlConnection(_loyaltyDbConnection);
            try
            {
                var userId = await conn.ExecuteScalarAsync<int>(sql, new
                {
                    request.Username,
                    PasswordHash = passwordHash,
                    Role = role,
                    request.StaffName
                });

                return await Login(new LoginRequest { Username = request.Username, Password = request.Password });
            }
            catch (SqlException ex) when (ex.Number == 2627)
            {
                return Conflict(new { message = "Username already taken." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Registration failed for user {Username}.", request.Username);
                return StatusCode(500, new { message = "Registration failed due to server error." });
            }
        }

        // POST: api/Auth/login
        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            // Fetch password hash and ThemePreference
            var userSql = "SELECT UserID, Username, StaffName, Role, ThemePreference, PasswordHash FROM Users WHERE Username = @Username AND IsActive = 1";
            using var conn = new SqlConnection(_loyaltyDbConnection);
            var user = await conn.QuerySingleOrDefaultAsync<User>(userSql, new { request.Username });

            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid username or password." });
            }

            var token = GenerateJwtToken(user);

            return Ok(new
            {
                token,
                user = new { user.Username, user.StaffName, user.Role, user.ThemePreference } // <-- ADDED ThemePreference
            });
        }

        // GET: api/Auth/me
        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var userClaims = User.Identity as ClaimsIdentity;
            if (userClaims == null)
            {
                return Unauthorized(new { message = "Token validation failed." });
            }

            var username = userClaims.FindFirst(ClaimTypes.Name)?.Value;
            var staffName = userClaims.FindFirst("StaffName")?.Value;
            var role = userClaims.FindFirst(ClaimTypes.Role)?.Value;
            var userIdString = userClaims.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (userIdString == null || !int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid token claims." });
            }

            string themePreference = "dark";
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                // Select only the preference from the database
                themePreference = await conn.ExecuteScalarAsync<string>("SELECT ThemePreference FROM Users WHERE UserID = @UserID", new { UserID = userId }) ?? "dark";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch theme preference for UserID {UserID}", userId);
            }

            return Ok(new
            {
                username,
                staffName,
                role,
                themePreference, // <-- ADDED ThemePreference
                message = "Token is valid."
            });
        }

        // PUT: api/Auth/theme
        [Authorize]
        [HttpPut("theme")]
        public async Task<IActionResult> SetThemePreference([FromBody] ThemeUpdateRequest request)
        {
            if (!ModelState.IsValid || (request.Theme != "light" && request.Theme != "dark"))
            {
                return BadRequest(new { message = "Invalid theme value. Must be 'light' or 'dark'." });
            }

            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdString == null || !int.TryParse(userIdString, out int userId))
            {
                return Unauthorized(new { message = "Invalid token claims." });
            }

            var sql = "UPDATE Users SET ThemePreference = @Theme WHERE UserID = @UserID";

            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                await conn.ExecuteAsync(sql, new { request.Theme, UserID = userId });
                return Ok(new { message = "Theme preference updated successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update theme preference for UserID {UserID}", userId);
                return StatusCode(500, new { message = "Database error updating theme." });
            }
        }

        private string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_securityKey);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserID.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("StaffName", user.StaffName)
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        // ---
        // --- NEW REQUEST MODEL FOR THEME UPDATE ---
        // ---
        public class ThemeUpdateRequest
        {
            [Required]
            public required string Theme { get; set; } // Must be "light" or "dark"
        }

        // ---
        // --- USER MANAGEMENT ENDPOINTS (UNCHANGED) ---
        // ---

        [Authorize(Roles = "Admin")]
        [HttpGet("users")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAllUsers()
        {
            var sql = "SELECT UserID, Username, Role, StaffName, IsActive, DateCreated FROM Users ORDER BY StaffName";
            using var conn = new SqlConnection(_loyaltyDbConnection);
            try
            {
                var users = await conn.QueryAsync<UserViewModel>(sql);
                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get all users.");
                return StatusCode(500, new { message = "Failed to fetch user list." });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("users/{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UserUpdateRequest request)
        {
            if (id != request.UserID)
            {
                return BadRequest(new { message = "User ID mismatch." });
            }

            if (string.IsNullOrEmpty(request.Role))
            {
                return BadRequest(new { message = "Role is required." });
            }

            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);

                if (!string.IsNullOrWhiteSpace(request.NewPassword))
                {
                    var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
                    var sql = @"UPDATE Users 
                                 SET Role = @Role, IsActive = @IsActive, PasswordHash = @PasswordHash
                                 WHERE UserID = @UserID";
                    await conn.ExecuteAsync(sql, new
                    {
                        request.Role,
                        request.IsActive,
                        PasswordHash = passwordHash,
                        request.UserID
                    });
                }
                else
                {
                    var sql = @"UPDATE Users 
                                 SET Role = @Role, IsActive = @IsActive
                                 WHERE UserID = @UserID";
                    await conn.ExecuteAsync(sql, new
                    {
                        request.Role,
                        request.IsActive,
                        request.UserID
                    });
                }

                return Ok(new { message = "User updated successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update user {UserID}.", request.UserID);
                return StatusCode(500, new { message = "Failed to update user." });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("users/delete/{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (currentUserId != null && int.TryParse(currentUserId, out int loggedInId) && loggedInId == id)
            {
                return BadRequest(new { message = "Cannot delete your own active account." });
            }

            var sql = "DELETE FROM Users WHERE UserID = @UserID";
            try
            {
                using var conn = new SqlConnection(_loyaltyDbConnection);
                int rowsAffected = await conn.ExecuteAsync(sql, new { UserID = id });

                if (rowsAffected == 0)
                {
                    return NotFound(new { message = "User not found." });
                }

                _logger.LogInformation("User with ID {UserID} was deleted.", id);
                return Ok(new { message = "User deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete user {UserID}.", id);
                return StatusCode(500, new { message = "Failed to delete user." });
            }
        }
    }
}