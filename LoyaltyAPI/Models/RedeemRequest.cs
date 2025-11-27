// Inside /Models/RedeemRequest.cs
using System.Collections.Generic;

namespace LoyaltyAPI.Models
{
    // This is the "cart" item
    public class RedemptionItem
    {
        public int Count { get; set; }
        public required string ClaimType { get; set; }
    }

    // This is the main request, which holds a list of items
    public class RedeemRequest
    {
        public required List<RedemptionItem> Items { get; set; }
        public required string HandledBy { get; set; }
    }
}