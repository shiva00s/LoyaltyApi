import React from 'react';
import { FaUserPlus, FaGift, FaShoppingBag, FaChartBar } from 'react-icons/fa';

// Helper function
//const formatCurrency = (value) => {
   // if (value === null || value === undefined) return '0.00 rs';
   // return `${value.toFixed(2)} rs`;
//};

function StatsBreakdown({ periodLabel, statsData }) {
    // Calculate totals safely
    const totalCreated = (statsData?.createdBy ?? []).reduce((sum, item) => sum + (item.createdCount || 0), 0);
    const redeemedItems = statsData?.redeemedBy ?? [];
    const totalRedeemed = redeemedItems.reduce((sum, item) => sum + (item.redeemedCount || 0), 0);
    const totalGift = redeemedItems.find(i => i.claimType === 'Gift')?.redeemedCount ?? 0;
    const totalPurchase = redeemedItems.find(i => i.claimType === 'Purchase')?.redeemedCount ?? 0;

    return (
        <div className="card list-card stats-breakdown">
            <div className="card-header">
                <FaChartBar className="card-icon" />
                <h3>{periodLabel} Breakdowns</h3>
            </div>
            <div className="card-body scrollable-list">
                <div className="stat-group">
                    <strong><FaUserPlus /> Created By ({totalCreated})</strong>
                    <div className="stat-breakdown-list">
                        {(statsData?.createdBy ?? []).length === 0 && <span className="text-muted">No creations.</span>}
                        {(statsData?.createdBy ?? []).map((item, i) => (
                            <div key={`created-${i}`} className="list-item-small">
                                <span>{item.handledBy || 'Unknown'}</span>
                                <span>{item.createdCount || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="stat-group">
                    <strong><FaGift /> Redeemed By ({totalRedeemed})</strong>
                    <div className="stat-breakdown-list">
                         {redeemedItems.length === 0 && <span className="text-muted">No redemptions.</span>}
                        {/* Always show Purchase and Gift, even if zero */}
                        <div className="list-item-small">
                            <span><FaShoppingBag /> Purchase</span>
                            <span>{totalPurchase}</span>
                        </div>
                        <div className="list-item-small">
                            <span><FaGift /> Gift</span>
                            <span>{totalGift}</span>
                        </div>
                        {/* Optionally show other claim types if they exist */}
                        {redeemedItems
                            .filter(i => i.claimType !== 'Gift' && i.claimType !== 'Purchase')
                            .map((item, i) => (
                                <div key={`redeemed-other-${i}`} className="list-item-small">
                                     <span>{item.claimType || 'Other'}</span>
                                     <span>{item.redeemedCount || 0}</span>
                                </div>
                         ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StatsBreakdown;