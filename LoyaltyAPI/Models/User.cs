using System;
using System.ComponentModel.DataAnnotations;

namespace LoyaltyAPI.Models
{
    // Corresponds to the Users table in LoyaltyDB
    public class User
    {
        public int UserID { get; set; }
        public required string Username { get; set; }
        public required string PasswordHash { get; set; }
        public required string Role { get; set; }
        public required string StaffName { get; set; }
        public bool IsActive { get; set; }
        public DateTime DateCreated { get; set; }
        public string ThemePreference { get; set; } = "dark";
    }

    // Model for incoming registration requests
    public class RegisterRequest
    {
        [Required]
        public required string Username { get; set; }
        [Required]
        public required string Password { get; set; }
        [Required]
        public required string StaffName { get; set; } // The real name
    }

    // Model for incoming login requests
    public class LoginRequest
    {
        [Required]
        public required string Username { get; set; }
        [Required]
        public required string Password { get; set; }
    }
}