using LoyaltyAPI.Controllers;
using LoyaltyAPI.Models;
using Microsoft.Extensions.Logging;
using RawPrint.NetStd;
using System;
using System.Text;
using System.Threading.Tasks;
using System.IO; // <-- ADD THIS for file operations

namespace LoyaltyAPI.Services
{
    public class PrinterService : IPrinterService
    {
        private readonly ILogger<PrinterService> _logger;

        public PrinterService(ILogger<PrinterService> logger)
        {
            _logger = logger;
        }

        public async Task PrintReceiptAsync(
            string printerName,
            string title,
            RedemptionReceiptViewModel receipt,
            bool printShopHeader,
            string shopName,
            string shopAddress,
            string shopContact)
        {
            // --- Define ESC/POS Commands (Unchanged) ---
            const string ESC = "\x1B";
            const string GS = "\x1D";
            const string NEW_LINE = "\n";
            const string INIT = ESC + "@";
            const string BOLD_ON = ESC + "E" + "\x01";
            const string BOLD_OFF = ESC + "E" + "0"; // Use "0" not "\x00"
            const string ALIGN_CENTER = ESC + "a" + "\x01";
            const string ALIGN_LEFT = ESC + "a" + "\x00";
            const string BIG_ON = GS + "!" + "\x11";
            const string BIG_OFF = GS + "!" + "\x00";
            const string CUT_PAPER = GS + "V" + "\x01";

            // --- Build the receipt text (Unchanged) ---
            var receiptText = new StringBuilder();
            receiptText.Append(INIT);
            receiptText.Append(ALIGN_CENTER);

            if (printShopHeader && !string.IsNullOrEmpty(shopName))
            {
                receiptText.Append(BOLD_ON);
                receiptText.Append(shopName + NEW_LINE);
                receiptText.Append(BOLD_OFF);
                if (!string.IsNullOrEmpty(shopAddress)) receiptText.Append(shopAddress + NEW_LINE);
                if (!string.IsNullOrEmpty(shopContact)) receiptText.Append(shopContact + NEW_LINE);
                receiptText.Append("-------------------------------" + NEW_LINE);
            }

            receiptText.Append(BIG_ON);
            receiptText.Append(title + NEW_LINE);
            receiptText.Append(BIG_OFF);
            receiptText.Append("-------------------------------" + NEW_LINE);

            receiptText.Append(ALIGN_LEFT);
            receiptText.Append(BOLD_ON);
            receiptText.Append($"Customer: {receipt.CustomerName}" + NEW_LINE);
            receiptText.Append($"Card No:  {receipt.CardNo}" + NEW_LINE);
            receiptText.Append($"Date:     {receipt.RedemptionDate.ToString("dd/MM/yyyy hh:mm tt")}" + NEW_LINE);
            receiptText.Append("-------------------------------" + NEW_LINE);

            foreach (var item in receipt.Items)
            {
                receiptText.Append($"{item.Count}x {item.ClaimType}" + NEW_LINE);
            }
            receiptText.Append("-------------------------------" + NEW_LINE);

            receiptText.Append(BIG_ON);
            receiptText.Append($"Total Value: {receipt.TotalValueRedeemed.ToString("F2")} rs" + NEW_LINE);
            receiptText.Append(BIG_OFF);
            receiptText.Append($"Total Coupons: {receipt.TotalCouponsRedeemed}" + NEW_LINE);

            receiptText.Append(NEW_LINE);
            receiptText.Append($"Handled By: {receipt.HandledBy}" + NEW_LINE);
            receiptText.Append(BOLD_OFF);

            receiptText.Append("-------------------------------" + NEW_LINE);
            receiptText.Append(ALIGN_CENTER);
            receiptText.Append("Thank You!" + NEW_LINE);
            receiptText.Append(NEW_LINE + NEW_LINE); // Feed paper
            receiptText.Append(CUT_PAPER);

            // --- THIS IS THE FIX ---
            string tempFilePath = Path.GetTempFileName();
            // --- END OF FIX ---

            // --- Send to printer ---
            try
            {
                // 1. Write the string to the temporary file
                await File.WriteAllTextAsync(tempFilePath, receiptText.ToString());

                // 2. Send the temporary file path to the printer
                IPrinter printer = new RawPrint.NetStd.Printer();
                await Task.Run(() => printer.PrintRawFile(printerName, tempFilePath, title));

                _logger.LogInformation("Receipt print job sent successfully to printer: {PrinterName}", printerName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RawPrint failed for printer {PrinterName}. Error: {ErrorMessage}", printerName, ex.Message);
                throw;
            }
            finally
            {
                // 3. Always delete the temporary file
                if (File.Exists(tempFilePath))
                {
                    File.Delete(tempFilePath);
                }
            }
        }
    }
}