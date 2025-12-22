import React, { useState, useEffect } from 'react';
import "react-datepicker/dist/react-datepicker.css";
import { FaTrophy, FaUsers, FaGift, FaCheckCircle, FaMoneyBillWave, FaIdCard } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { apiCall } from './ApiService';
import LoadingSpinner from './Components/LoadingSpinner';
import './Report.css'; // We will re-use the same CSS as the other reports

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

function CustomerReport({ onNavigateToReport }) {
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- ADD THIS NEW CLICK HANDLER ---
const handleCustomerClick = (cardNo) => {
    if (!cardNo || !onNavigateToReport) return;

    // Redirect to the main 'reports' page with 'identifier' (CardNo) pre-filtered
    onNavigateToReport('reports', {
        identifier: cardNo,
        status: 'all', // Show all statuses by default
        // Do not pass dates, let the report page use its default 30-day range
    });
    toast.info(`Showing Main Report filtered by Card No: ${cardNo}`);
};
// --- END NEW CLICK HANDLER ---

  // Fetch report when component mounts
  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setReportData([]);
      
      try {
        const data = await apiCall('report/customer-performance');
        setReportData(data);
        
        if (data.length === 0) {
          toast.info("No customer data found.");
        }
      } catch (err) {
        // apiCall handles the toast error
      }
      setIsLoading(false);
    };

    fetchReport();
  }, []); // Run only once on mount

  return (
    <div className="report-page">
      <div className="card report-table-card">
        <div className="card-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <h3>Customer Report</h3>
        </div>
        {isLoading ? (
          <LoadingSpinner message="Loading Customer Report..." />
        ) : (
          <div className="card-body table-container"> 
            <table className="report-table">
              <thead>
                <tr>
                  <th><FaUsers /> Customer Name</th>
                  <th><FaIdCard /> Card No / Contact</th>
                  <th><FaTrophy /> Tier</th>
                  <th><FaGift /> Balance Points</th>
                  <th><FaGift /> Coupons Earned (Lifetime)</th>
                  <th><FaCheckCircle /> Coupons Redeemed (Lifetime)</th>
                  <th><FaMoneyBillWave /> Value Redeemed (Lifetime)</th>
                </tr>
              </thead>
              <tbody>
                {reportData.length === 0 ? (
                   <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#a0a5b1' }}>
                          No customer data found.
                      </td>
                   </tr>
                ) : (
                  reportData.map((cust) => {
                    const { icon, className } = getTierDetails(cust.tier);
                    return (
                      <tr key={cust.cardNo}>
                       <td>
                        <button 
                            className="clickable-name"
                            onClick={() => handleCustomerClick(cust.cardNo)}
                        >
                            <strong>{cust.cName || 'N/A'}</strong>
                        </button>
                       </td>
                        <td>
                          <div>{cust.cardNo}</div>
                          <div style={{fontSize: '0.9em', color: '#a0a5b1'}}>{cust.cContact}</div>
                        </td>
                        <td>
                          <span className={`tier-badge ${className}`} style={{fontSize: '0.9em', padding: '4px 8px'}}>
                            {icon} {cust.tier}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{cust.balancePoints || 0}</td>
                        <td style={{ textAlign: 'right' }}>{cust.totalCouponsEarned}</td>
                        <td style={{ textAlign: 'right' }}>{cust.totalCouponsRedeemed}</td>
                        <td style={{ textAlign: 'right' }}>{cust.totalValueRedeemed.toFixed(2)} rs</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerReport;