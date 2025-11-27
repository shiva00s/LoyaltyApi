import React from 'react';
import { FaTrophy, FaGift, FaShoppingBag, FaCalendarAlt, FaUser } from 'react-icons/fa';

// Helper function
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { month: 'short', day: 'numeric' }; // Simplified date
    try {
        return new Date(dateString).toLocaleDateString('en-US', options);
    } catch (e) {
        return "Invalid Date";
    }
};

// Helper function
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0.00 rs';
    return `${value.toFixed(2)} rs`;
};

function TopRedeemersList({ redeemers, onCustomerClick }) {
    return (
        <div className="card list-card top-redeemers">
            <div className="card-header">
                <FaTrophy className="card-icon" />
                <h3>Top Redeemers</h3>
            </div>
            <div className="card-body scrollable-list">
                {redeemers.length === 0 && <p className="text-muted text-center">No redemption data available.</p>}
                {redeemers.map((item, index) => (
                    <div key={item.cardNo + '-' + index} className="info-card"> {/* Better key */}
                        <div className="info-card-header">
                            <button
                                className="clickable-name"
                                onClick={() => onCustomerClick(item.cardNo, item.cName, item.cContact)}
                            >
                                {item.cName || item.cardNo || 'Unknown'}
                            </button>
                            {/* Tier Badge is Optional Here */}
                            {/* <span className={`tier-badge tier-${item.Tier?.toLowerCase() || 'bronze'}`}>{item.Tier || 'Bronze'}</span> */}
                            <span className="text-highlight">{item.totalRedeemedCoupons || 0} all-time</span>
                        </div>
                        <ul className="info-card-details">
                            <li><FaGift /><span>Value:</span><strong>{formatCurrency(item.totalRedeemedAmount)}</strong></li>
                            <li><FaShoppingBag /><span>Breakdown:</span><strong>{(item.totalPurchaseCoupons ?? 0)}P / {(item.totalGiftCoupons ?? 0)}G</strong></li>
                            <li><FaCalendarAlt /><span>Last Date:</span><strong>{formatDate(item.lastRedemptionDate)}</strong></li>
                            <li><FaUser /><span>Last By:</span><strong>{item.handledBy || 'N/A'}</strong></li>
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default TopRedeemersList;