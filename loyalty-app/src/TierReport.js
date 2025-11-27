import React, { useState, useEffect } from 'react';
import "react-datepicker/dist/react-datepicker.css";
import { FaTrophy, FaUsers, FaGift, FaCheckCircle, FaMoneyBillWave } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { apiCall } from './ApiService'; // <-- NEW IMPORT

// Helper to get the right icon and class for each tier
const getTierDetails = (tierName) => {
    switch (tierName?.toLowerCase()) {
        case 'gold':
            return { icon: <FaTrophy />, className: 'tier-gold' };
        case 'silver':
            return { icon: <FaTrophy />, className: 'tier-silver' };
        default:
            return { icon: <FaTrophy />, className: 'tier-bronze' };
    }
}

function TierReport() {
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReport = async () => {
    setIsLoading(true);
    setReportData([]);
    
    try {
      // --- UPDATED API CALL ---
      const data = await apiCall('report/tier-summary');
      // --- END UPDATED API CALL ---
      
      setReportData(data);
      
      if (data.length === 0) {
        toast.info("No tier data found.");
      }

    } catch (err) {
      // apiCall handles the toast error, we just reset state
      // console.error("Error fetching tier report", err); 
    }
    setIsLoading(false);
  };

  // Fetch report when component mounts
  useEffect(() => {
    fetchReport();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return (
    <div className="report-page">
      {/* --- Results Table --- */}
      <div className="card report-table-card">
        <div className="card-header">
            <h3>Customer Tier Summary</h3>
        </div>
        <div className="card-body table-container"> 
          <table className="report-table">
            <thead>
              <tr>
                <th><FaTrophy /> Tier</th>
                <th><FaUsers /> Customer Count</th>
                <th><FaGift /> Pending Coupons (Count)</th>
                <th><FaMoneyBillWave /> Pending Coupons (Value)</th>
                <th><FaCheckCircle /> Redeemed Coupons (Count)</th>
                <th><FaMoneyBillWave /> Redeemed Coupons (Value)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr> 
                  <td colSpan="6" className="loading-row">
                    <div className="loading-spinner" style={{ padding: '30px 0'}}>
                      <div className="dot1"></div> <div className="dot2"></div> <div className="dot3"></div>
                    </div>
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                 <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#a0a5b1' }}>
                        No tier data found.
                    </td>
                 </tr>
              ) : (
                reportData.map((tier) => {
                  const { icon, className } = getTierDetails(tier.tier);
                  return (
                    <tr key={tier.tier}>
                      <td>
                        <span className={`tier-badge ${className}`} style={{fontSize: '1em', padding: '5px 10px'}}>
                          {icon} {tier.tier}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{tier.customerCount}</td>
                      <td style={{ textAlign: 'right' }}>{tier.totalPendingCount}</td>
                      <td style={{ textAlign: 'right' }}>{tier.totalPendingValue.toFixed(2)} rs</td>
                      <td style={{ textAlign: 'right' }}>{tier.totalRedeemedCount}</td>
                      <td style={{ textAlign: 'right' }}>{tier.totalRedeemedValue.toFixed(2)} rs</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TierReport;