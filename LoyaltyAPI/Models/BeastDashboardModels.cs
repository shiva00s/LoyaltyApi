using System;
using System.Collections.Generic;

namespace LoyaltyAPI.Models
{
    // Model for the "Pending Coupons" list
    public class BeastPendingCustomer
    {
        public string? CardNo { get; set; }
        public string? CContact { get; set; }
        public string? CName { get; set; }
        public DateTime LastAddedDate { get; set; }
        public decimal TotalRedeemableValue { get; set; }
        public int TotalRedeemableCount { get; set; }
        public string? Tier { get; set; }
    }

    // Model for the "Latest Redemptions" list
    public class BeastLatestRedemption
    {
        public string? Tier { get; set; }
        public string? CardNo { get; set; }
        public string? CContact { get; set; }
        public string? CName { get; set; }
        public decimal TotalValue { get; set; }
        public int TotalCoupons { get; set; }
        public string? HandledBy { get; set; }
        public int BalanceCouponCount { get; set; }
        public double BalancePoints { get; set; }
        public DateTime DateRedeemed { get; set; }
        public int GiftCount { get; set; } // Added from worker
        public int PurchaseCount { get; set; } // Added from worker
    }

    // Model for the "Top Redeemers" list
    public class BeastTopRedeemer
    {
        public string? Tier { get; set; }
        public string? CardNo { get; set; }
        public string? CContact { get; set; }
        public string? CName { get; set; }
        public DateTime LastRedemptionDate { get; set; }
        public string? HandledBy { get; set; }
        public int TotalGiftCoupons { get; set; }
        public int TotalPurchaseCoupons { get; set; }
        public decimal TotalRedeemedAmount { get; set; }
        public int TotalRedeemedCoupons { get; set; }
    }

    // This is the main view model that holds all parts of the dashboard
    public class BeastDashboardViewModel
    {
        public BeastStatsViewModel Stats { get; set; } = new BeastStatsViewModel();
        public List<BeastLatestRedemption> LatestRedemptions { get; set; } = new List<BeastLatestRedemption>();
        public List<BeastPendingCustomer> PendingCustomers { get; set; } = new List<BeastPendingCustomer>();
        public List<BeastTopRedeemer> TopRedeemers { get; set; } = new List<BeastTopRedeemer>();

        // This was in your original DashboardController, so we keep it
        public List<BeastPendingCustomer> InactiveCustomers { get; set; } = new List<BeastPendingCustomer>();
    }
}