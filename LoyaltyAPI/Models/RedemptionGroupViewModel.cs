using System;
namespace LoyaltyAPI.Models
{
    public class RedemptionGroupViewModel
    {
        public required string CName { get; set; }
        public decimal TotalValue { get; set; }
        public int TotalCoupons { get; set; }
        public int GiftCount { get; set; }
        public int PurchaseCount { get; set; }
        public DateTime DateRedeemed { get; set; }
        public required string HandledBy { get; set; }
    }
}