import React from 'react';
import './LoadingSpinner.css'; // We'll need to create this CSS file too

function LoadingSpinner({ message = "Loading..." }) {
    return (
        <div className="loading-spinner-overlay"> {/* Optional: use an overlay */}
            <div className="loading-spinner">
                {/* You can use simple divs or an SVG for the spinner */}
                <div className="dot1"></div>
                <div className="dot2"></div>
                <div className="dot3"></div>
            </div>
            <p className="loading-message">{message}</p>
        </div>
    );
}

export default LoadingSpinner;