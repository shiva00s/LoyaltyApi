using System.Collections.Generic;

namespace LoyaltyAPI.Models
{
    // Model for created coupons breakdown
    public class CreatedBreakdown
    {
        public string? HandledBy { get; set; }
        public int CreatedCount { get; set; }
    }

    // Model for redeemed coupons breakdown
    public class RedeemedBreakdown
    {
        public string? ClaimType { get; set; }
        public int RedeemedCount { get; set; }
    }

    // Model for a single time period's stats (e.g., Today)
    public class TimePeriodStats
    {
        public int CouponsCreated { get; set; }
        public decimal ValueCreated { get; set; }
        public int CouponsRedeemed { get; set; }
        public decimal ValueRedeemed { get; set; }
        public List<CreatedBreakdown> CreatedBy { get; set; } = new List<CreatedBreakdown>();
        public List<RedeemedBreakdown> RedeemedBy { get; set; } = new List<RedeemedBreakdown>();
    }

    // Model that groups all time periods
    public class BeastStatsViewModel
    {
        public TimePeriodStats Today { get; set; } = new TimePeriodStats();
        public TimePeriodStats Weekly { get; set; } = new TimePeriodStats();
        public TimePeriodStats ThirtyDays { get; set; } = new TimePeriodStats();
    }
}