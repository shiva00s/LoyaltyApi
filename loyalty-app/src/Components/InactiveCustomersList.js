import React from 'react';
import { FaUsers, FaGift, FaCalendarAlt } from 'react-icons/fa';

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

function InactiveCustomersList({ customers, onCustomerClick }) {
    return (
        <div className="card list-card inactive-customers">
            <div className="card-header">
                <FaUsers className="card-icon" />
                <h3>Inactive Customers</h3>
            </div>
            <div className="card-body scrollable-list">
                 {customers.length === 0 && <p className="text-muted text-center">No inactive customers found.</p>}
                {customers.map((item, index) => (
                    <div key={item.cardNo + '-' + index} className="info-card"> {/* Better key */}
                        <div className="info-card-header">
                            <button
                                className="clickable-name"
                                onClick={() => onCustomerClick(item.cardNo, item.cName, item.cContact)}
                            >
                                {item.cName || item.cardNo || 'Unknown'}
                            </button>
                             {/* Optionally add Tier */}
                             {/* <span className={`tier-badge tier-${item.Tier?.toLowerCase() || 'bronze'}`}>{item.Tier || 'Bronze'}</span> */}
                            <span className="text-highlight">{item.totalRedeemableCount || 0} pending</span>
                        </div>
                        <ul className="info-card-details">
                            <li><FaGift /><span>Value:</span><strong>{formatCurrency(item.totalRedeemableValue)}</strong></li>
                            <li><FaCalendarAlt /><span>Last Added:</span><strong>{formatDate(item.lastAddedDate)}</strong></li>
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default InactiveCustomersList;