using System;
namespace LoyaltyAPI.Models
{
    public class TopRedeemersViewModel
    {
        public required string CName { get; set; }
        public int RedeemedCount { get; set; }
        public DateTime LastRedeemedDate { get; set; } // New field
        public required string LastHandledBy { get; set; } // New field
    }
}