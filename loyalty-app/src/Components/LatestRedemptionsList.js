import React from 'react';
import { FaGift, FaShoppingBag, FaUser, FaCalendarAlt, FaLandmark, FaUserClock } from 'react-icons/fa';

// Helper function (can be moved to a shared utils file later)
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
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


function LatestRedemptionsList({ redemptions, onCustomerClick }) {
    return (
        <div className="card list-card latest-redemptions">
            <div className="card-header">
                <FaGift className="card-icon" />
                <h3>Latest Redemptions</h3>
            </div>
            <div className="card-body scrollable-list">
                {redemptions.length === 0 && <p className="text-muted text-center">No redemptions found.</p>}
                {redemptions.map((item, index) => (
                    <div key={item.cardNo + '-' + index} className="info-card"> {/* Better key */}
                        <div className="info-card-header">
                            <button
                                className="clickable-name"
                                onClick={() => onCustomerClick(item.cardNo, item.cName, item.cContact)}
                            >
                                {item.cName || item.cardNo || 'Unknown'}
                            </button>
                            <span className={`tier-badge tier-${item.Tier?.toLowerCase() || 'bronze'}`}>{item.Tier || 'Bronze'}</span>
                            <span className="text-highlight">{formatCurrency(item.totalValue)}</span>
                        </div>
                        <ul className="info-card-details">
                            <li>
                                <FaShoppingBag /><span>Redeemed:</span>
                                <strong>
                                    {item.totalCoupons || 0} ({(item.purchaseCount ?? 0)}P / {(item.giftCount ?? 0)}G)
                                </strong>
                            </li>
                            <li><FaUser /><span>By:</span><strong>{item.handledBy || 'N/A'}</strong></li>
                            <li><FaCalendarAlt /><span>On:</span><strong>{formatDate(item.dateRedeemed)}</strong></li>
                            <li className="divider"></li>
                            <li><FaLandmark /><span>Bal Points:</span><strong>{item.balancePoints ?? 0} pts</strong></li>
                            <li><FaUserClock /><span>Bal Coupons:</span><strong>{item.balanceCouponCount ?? 0}</strong></li>
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default LatestRedemptionsList;