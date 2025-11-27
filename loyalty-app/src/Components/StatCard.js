import React from 'react';

// Helper function
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0.00 rs';
    return `${value.toFixed(2)} rs`;
};

// StatCard component now accepts an optional customClass
function StatCard({ icon, label, value, subtext, customClass = '' }) {
    return (
        // Add customClass to the main div
        <div className={`card stat-card ${customClass}`}>
            {/* Clone element to apply a default class, icon color handled by CSS */}
            {React.cloneElement(icon, { className: "stat-icon" })}
            <div className="stat-info">
                <div className="stat-label">{label}</div>
                <div className="stat-big-number">{value}</div>
                <div className="stat-subtext">{formatCurrency(subtext)}</div>
            </div>
        </div>
    );
}

export default StatCard;