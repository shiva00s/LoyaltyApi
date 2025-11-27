namespace LoyaltyAPI.Models
{
    public class StaffPerformanceViewModel
    {
        public string? HandledBy { get; set; }
        public int ManualCouponsCreated { get; set; }
        public int CouponsRedeemed { get; set; }
        public decimal ValueRedeemed { get; set; }
        public int RedeemedAsGift { get; set; }
        public int RedeemedAsPurchase { get; set; }
    }
}