import React from 'react';
import { FaUserClock, FaGift, FaCalendarAlt } from 'react-icons/fa';

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

function PendingCustomersList({ customers, onCustomerClick }) {
    return (
        <div className="card list-card pending-coupons">
            <div className="card-header">
                <FaUserClock className="card-icon" />
                <h3>Pending Coupons</h3>
            </div>
            <div className="card-body scrollable-list">
                 {customers.length === 0 && <p className="text-muted text-center">No customers with pending coupons.</p>}
                {customers.map((item, index) => (
                    <div key={item.cardNo + '-' + index} className="info-card"> {/* Better key */}
                        <div className="info-card-header">
                            <button
                                className="clickable-name"
                                onClick={() => onCustomerClick(item.cardNo, item.cName, item.cContact)}
                            >
                                {item.cName || item.cardNo || 'Unknown'}
                            </button>
                            <span className="text-highlight">{item.totalRedeemableCount || 0} coupons</span>
                        </div>
                        <ul className="info-card-details">
                            <li><FaGift /><span>Value:</span><strong>{formatCurrency(item.totalRedeemableValue)}</strong></li>
                            <li><FaCalendarAlt /><span>Last Added:</span><strong>{formatDate(item.lastAddedDate)}</strong></li>
                             {/* Optionally add Tier */}
                             {/* <li><FaTrophy /><span>Tier:</span><strong>{item.Tier || 'Bronze'}</strong></li> */}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PendingCustomersList;