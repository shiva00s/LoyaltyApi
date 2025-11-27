import React, { useEffect, useState } from 'react';
import './ReceiptPreview.css';
import { apiCall } from './ApiService'; // Import apiCall

function ReceiptPreviewModal({ receipt: receiptResponse, onClose }) {
  // --- THIS IS THE FIX ---
  // The 'receiptResponse' prop now contains the *entire* object:
  // { receipt: {...}, shopSettings: {...} }

  // Extract the actual receipt data and shop settings from the prop
  const receipt = receiptResponse?.receipt;
  const shopSettings = receiptResponse?.shopSettings;
  // --- END FIX ---

  const [printMode, setPrintMode] = useState('Preview'); // Default to Preview

  // 1. Fetch Print Mode Setting
  useEffect(() => {
    const fetchPrintMode = async () => {
      try {
        const settings = await apiCall('settings');
        const mode = settings.find(s => s.settingKey === 'PrintMode')?.settingValue;
        if (mode) {
          setPrintMode(mode);
        }
      } catch (e) {
        console.error("Failed to fetch print mode setting for modal.", e);
      }
    };
    fetchPrintMode();
  }, []);

  // 2. Call the browser's print dialog
  const handlePrint = () => {
    window.print();
  };

  // 3. Automatically trigger print ONLY if mode is 'Preview'
  useEffect(() => {
    if (printMode === 'Preview') {
        const timer = setTimeout(() => {
            handlePrint();
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [printMode]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  // If receipt data isn't loaded yet, show nothing
  if (!receipt) {
    return null;
  }

  return (
    <div className="receipt-modal-overlay">
      <div className="receipt-modal-content">
        
        {/* --- NEW: SHOP HEADER --- */}
        {shopSettings && shopSettings.printShopHeader && (
          <div className="receipt-shop-header">
            {shopSettings.shopName && <strong>{shopSettings.shopName}</strong>}
            {shopSettings.shopAddress && <span>{shopSettings.shopAddress}</span>}
            {shopSettings.shopContact && <span>{shopSettings.shopContact}</span>}
          </div>
        )}
        {/* --- END: SHOP HEADER --- */}

        <div className="receipt-header">
          <h3>COUPON REDEMPTION</h3>
          {printMode === 'Raw' && (
              <p style={{color: '#ffc107', fontSize: '0.9em'}}>
                  (Raw Print Sent: Print this preview manually if needed)
              </p>
          )}
        </div>

        <div className="receipt-details">
          <div><strong>Customer:</strong> {receipt.customerName}</div>
          <div><strong>Card No:</strong> {receipt.cardNo}</div>
          <div><strong>Date:</strong> {formatDate(receipt.redemptionDate)}</div>
        </div>

        <div className="receipt-items">
          {receipt.items.map((item, index) => (
            <div key={index} className="receipt-item">
              <span>{item.count}x {item.claimType}</span>
            </div>
          ))}
        </div>

        <div className="receipt-total">
          <div>Total Coupons: {receipt.totalCouponsRedeemed}</div>
          <div>Total Value: {receipt.totalValueRedeemed.toFixed(2)} rs</div>
        </div>

        <div className="receipt-footer">
          <div>Handled By: {receipt.handledBy}</div>
          <div>Thank You!</div>
        </div>

        <div className="receipt-actions">
          <button className="btn-receipt-close" onClick={onClose}>
            Close
          </button>
          <button className="btn-receipt-print" onClick={handlePrint}>
            Print Again
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReceiptPreviewModal;