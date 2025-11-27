using System;
using System.Collections.Generic;

namespace LoyaltyAPI.Models
{
    // --- Models used by the Worker Service ---

    public class Promotion
    {
        public int PromotionID { get; set; }
        public string? Name { get; set; } // <-- MADE NULLABLE
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal CouponValue { get; set; }
        public bool IsEnabled { get; set; }
    }

    public class TierSettings // <-- MADE PUBLIC
    {
        public double PointsPerCoupon_Bronze { get; set; } = 100;
        public double CouponValue_Bronze { get; set; } = 250;
        public double PointsPerCoupon_Silver { get; set; } = 100;
        public double CouponValue_Silver { get; set; } = 250;
        public double PointsPerCoupon_Gold { get; set; } = 100;
        public double CouponValue_Gold { get; set; } = 250;
        public int DefaultExpiryDays { get; set; } = 90;
        public int TierThreshold_Silver { get; set; } = 10;
        public int TierThreshold_Gold { get; set; } = 50;
    }
}