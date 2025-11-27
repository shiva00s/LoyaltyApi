using System;
namespace LoyaltyAPI.Models
{
    public class InactiveCustomerViewModel
    {
        public required string CName { get; set; }
        public int PendingCount { get; set; }
        public DateTime LastActivityDate { get; set; } // New field
        public required string LastHandledBy { get; set; } // New field
    }
}