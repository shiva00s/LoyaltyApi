using System;
using System.ComponentModel.DataAnnotations;

namespace LoyaltyAPI.Models
{
    // Model for displaying a list of users in the admin panel
    public class UserViewModel
    {
        public int UserID { get; set; }
        public required string Username { get; set; }
        public required string Role { get; set; }
        public required string StaffName { get; set; }
        public bool IsActive { get; set; }
        public DateTime DateCreated { get; set; }
    }

    // Model for updating a user's details from the admin panel
    public class UserUpdateRequest
    {
        [Required]
        public int UserID { get; set; }

        [Required]
        public required string Role { get; set; } // e.g., "Admin" or "Staff"

        [Required]
        public bool IsActive { get; set; }

        // Optional: If a new password is provided, it will be updated
        public string? NewPassword { get; set; }
    }
}