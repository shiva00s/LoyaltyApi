using System;
using System.Collections.Generic; // Make sure this is included for List

namespace LoyaltyAPI.Models // Ensure this namespace is correct for your project
{
    // --- Define the helper class for coupon details FIRST ---
    public class PendingCoupon
    {
        public int CouponID { get; set; }
        public decimal Value { get; set; }
        public DateTime? ExpiryDate { get; set; } // Use DateTime? for nullability
    }

    // --- Define the main ViewModel class ONCE ---
    public class CustomerViewModel
    {
        public string? CardNo { get; set; }
        public string? CName { get; set; }
        public string? CContact { get; set; }

        // Data from BillnusBP
        public double CurrentPoints { get; set; }

        // Data from LoyaltyDB
        public int AvailableCoupons { get; set; }
        public string? Tier { get; set; }
        public List<PendingCoupon> PendingCoupons { get; set; } // Include the list

        // Constructor to initialize the list
        public CustomerViewModel()
        {
            PendingCoupons = new List<PendingCoupon>(); // Initialize the list
        }
    }
}