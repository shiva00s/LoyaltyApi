import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FaTimes, FaTrash, FaExclamationTriangle, FaCalendarTimes, FaGift, FaShoppingBag, FaCartPlus, FaPlus } from 'react-icons/fa';
import './CustomerDashboard.css';
import ReceiptPreviewModal from './ReceiptPreviewModal';
import { apiCall } from './ApiService'; 

// --- HELPER FUNCTION (Unchanged) ---
const formatExpiry = (dateString) => {
    if (!dateString) { return { text: 'No Expiry', warning: false }; }
    const expiryDate = new Date(dateString); const today = new Date();
    const diffTime = expiryDate - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' }; const formattedDate = expiryDate.toLocaleDateString('en-US', dateOptions);
    if (diffDays <= 0) { return { text: `Expired on ${formattedDate}`, warning: true }; }
    if (diffDays <= 7) { return { text: `Expires in ${diffDays} day(s) (${formattedDate})`, warning: true }; }
    return { text: `Expires on ${formattedDate}`, warning: false };
};
// --- END HELPER FUNCTION ---


function CustomerDashboard({ customer, onClear, staffList }) { 

  const [cart, setCart] = useState({ Purchase: 0, Gift: 0 });
  const [handledBy, setHandledBy] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null); 

  const totalInCart = cart.Purchase + cart.Gift;
  // This calculates available coupons for display, NOT cart logic
  const availableCoupons = (customer.availableCoupons || 0);
  const remainingInWallet = availableCoupons - totalInCart;


  // Add item logic (MODIFIED)
  const handleAddToCart = (claimType) => {
    if (remainingInWallet <= 0) { // Check against wallet
      toast.error(`No more coupons available to add.`);
      return;
    }
    setCart(prevCart => ({
      ...prevCart,
      [claimType]: prevCart[claimType] + 1
    }));
  };

  // Remove item logic (Unchanged)
  const handleRemoveFromCart = (claimType) => {
    if (cart[claimType] <= 0) { return; }
    setCart(prevCart => ({
      ...prevCart,
      [claimType]: prevCart[claimType] - 1
    }));
  };

  // Redeem logic (Unchanged)
  const handleRedeem = async () => {
    if (totalInCart === 0) {
      toast.error('Please add at least one coupon type to redeem.');
      return;
    }
    if (!handledBy) {
      toast.error('Please select who is handling this redemption.');
      return;
    }

    const itemsToRedeem = [];
    if (cart.Purchase > 0) { itemsToRedeem.push({ Count: cart.Purchase, ClaimType: 'Purchase' }); }
    if (cart.Gift > 0) { itemsToRedeem.push({ Count: cart.Gift, ClaimType: 'Gift' }); }

    const redeemData = { Items: itemsToRedeem, HandledBy: handledBy };

    setIsLoading(true);
    try {
      const result = await apiCall(`customer/${customer.cardNo}/redeem`, {
        method: 'POST',
        body: JSON.stringify(redeemData),
      });
      
      toast.success(`Successfully redeemed ${result.receipt.totalCouponsRedeemed} coupons.`);
      setReceiptData(result); // Show the receipt modal
      
    } catch (error) { 
      console.error('Error during redemption:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to close the modal and reset view (Unchanged)
  const handleCloseReceipt = () => {
    if (receiptData) { 
        setReceiptData(null); 
        onClear(); 
    }
  };

  return (
    <div className="card customer-dashboard">
      
      {/* --- RECEIPT MODAL RENDER --- */}
      {receiptData && (
        <ReceiptPreviewModal receipt={receiptData} onClose={handleCloseReceipt} />
      )}
      
      {/* --- HEADER (Unchanged) --- */}
      <div className="card-header">
        <div className="customer-header-info">
             <h2>Customer: {customer.cName}</h2>
             {customer.Tier && ( <span className={`tier-badge tier-${customer.Tier.toLowerCase()}`}>{customer.Tier}</span> )}
        </div>
        <button className="clear-btn" onClick={onClear}><FaTimes /></button>
      </div>

      {/* --- NEW 2-COLUMN BODY --- */}
      <div className="customer-dashboard-body-grid">
        
        {/* --- LEFT COLUMN (Info & Redeem Actions) --- */}
        <div className="customer-dashboard-left-col">
          
          {/* Customer Info (MODIFIED) */}
          <div className="customer-info">
              <div className="detail-row"><strong>Contact:</strong> <span>{customer.cContact || 'N/A'}</span></div>
              <div className="detail-row"><strong>Balance Points:</strong> <span>{customer.currentPoints}</span></div>
              <div className="detail-row"><strong>Available Coupons:</strong> 
                <span style={{color: '#2ecc71', fontWeight: 'bold'}}>{availableCoupons}</span>
              </div>
          </div>
          
          {/* --- REDEEM SECTION (MOVED HERE) --- */}
          {customer.availableCoupons > 0 && (
            <div className="redeem-container cart-style">
              <h3 style={{marginBottom: '15px'}}><FaCartPlus style={{marginRight: '10px'}}/>Add to Redemption Cart</h3>
              
              <div className="add-buttons-container">
                <button className="tab-button add-cart-btn" onClick={() => handleAddToCart('Purchase')} disabled={isLoading || remainingInWallet <= 0}>
                  <FaShoppingBag /> Purchase <FaPlus style={{marginLeft: '5px', fontSize: '0.8em'}}/>
                </button>
                <button className="tab-button add-cart-btn" onClick={() => handleAddToCart('Gift')} disabled={isLoading || remainingInWallet <= 0}>
                  <FaGift /> Gift <FaPlus style={{marginLeft: '5px', fontSize: '0.8em'}}/>
                </button>
              </div>

              <hr className="divider" />

              <div className="redeem-form finalize-form">
                <select className="form-select" value={handledBy} onChange={(e) => setHandledBy(e.target.value)} disabled={isLoading}>
                  <option value="">Handled By?</option>
                  {staffList && staffList.map(staff => (<option key={staff} value={staff}>{staff}</option>))}
                </select>
                <button onClick={handleRedeem} className="tab-button active" disabled={isLoading || totalInCart === 0 || !handledBy}>
                  {isLoading ? "Redeeming..." : `Redeem All ${totalInCart} Coupons`}
                </button>
              </div>
            </div>
          )}
          {/* --- END REDEEM SECTION --- */}

        </div>
        {/* --- END LEFT COLUMN --- */}


        {/* --- RIGHT COLUMN (Coupon List & Cart Summary) --- */}
        <div className="customer-dashboard-right-col">
          
          {/* Available Coupons List (MOVED) */}
          <div className="coupon-list-container">
            <h3>Available Coupons ({availableCoupons})</h3>
            <div className="scrollable-coupon-list">
              {availableCoupons === 0 ? (
                  <p style={{padding: '15px', color: '#a0a5b1', textAlign: 'center'}}>No coupons available to redeem.</p>
              ) : (
                  customer.PendingCoupons && customer.PendingCoupons.map(coupon => {
                      const expiry = formatExpiry(coupon.expiryDate);
                      return (
                          <div key={coupon.couponID} className="info-card coupon-list-item">
                              <div className="info-card-header">
                                  <strong>Value: {coupon.value.toFixed(2)} rs</strong>
                                  <span className={`expiry-warning ${expiry.warning ? 'visible' : ''}`}>
                                      {expiry.warning ? <FaExclamationTriangle /> : <FaCalendarTimes />}
                                      {expiry.text}
                                  </span>
                              </div>
                          </div>
                      );
                  })
              )}
            </div>
          </div>
          {/* --- END COUPON LIST --- */}
          
          {/* --- CART SUMMARY (MOVED HERE) --- */}
          {totalInCart > 0 && (
            <div className="cart-container cart-summary">
              <h4>Redemption Cart</h4>
              <div className="cart-items">
                {cart.Purchase > 0 && (
                  <div className="cart-item">
                    <span><FaShoppingBag /> Purchase: {cart.Purchase}</span>
                    <button onClick={() => handleRemoveFromCart('Purchase')} className="remove-item-btn small-btn" disabled={isLoading}><FaTrash /></button>
                  </div>
                )}
                {cart.Gift > 0 && (
                  <div className="cart-item">
                    <span><FaGift /> Gift: {cart.Gift}</span>
                    <button onClick={() => handleRemoveFromCart('Gift')} className="remove-item-btn small-btn" disabled={isLoading}><FaTrash /></button>
                  </div>
                )}
              </div>
              <h3 className="cart-total">Total to Redeem: {totalInCart} Coupons</h3>
            </div>
          )}
          {/* --- END CART SUMMARY --- */}

        </div>
        {/* --- END RIGHT COLUMN --- */}

      </div>
      {/* --- END 2-COLUMN BODY --- */}
    </div>
  );
}

export default CustomerDashboard;