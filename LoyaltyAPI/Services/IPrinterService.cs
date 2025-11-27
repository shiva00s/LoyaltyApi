using LoyaltyAPI.Controllers; // This might be LoyaltyAPI.Models, check your project
using LoyaltyAPI.Models; // Needed for RedemptionReceiptViewModel
using System.Threading.Tasks;

namespace LoyaltyAPI.Services
{
    // This is the model for the receipt.
    // If this is defined in CustomerController.cs, you may need to move it to a 
    // separate file in /Models/RedemptionReceiptViewModel.cs
    // For now, we assume it's correctly referenced.

    public interface IPrinterService
    {
        // This is the "contract" for our printer.
        // We are adding the new shop header details to it.
        Task PrintReceiptAsync(
            string printerName,
            string title,
            RedemptionReceiptViewModel receipt,

            // --- ADD THESE NEW PARAMETERS ---
            bool printShopHeader,
            string shopName,
            string shopAddress,
            string shopContact
        );
    }
}