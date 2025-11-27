using System;
namespace LoyaltyAPI.Models
{
    public class PendingCouponsViewModel
    {
        public required string CName { get; set; }
        public int PendingCount { get; set; }
        public double BalancePoints { get; set; } // New field
        public DateTime LastAddedDate { get; set; } // New field
    }
}