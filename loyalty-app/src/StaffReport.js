import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { FaUser, FaMoneyBillWave, FaGift, FaShoppingBag,  FaCalendarAlt, FaCheckCircle, FaPlusSquare } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { apiCall } from './ApiService';
import LoadingSpinner from './Components/LoadingSpinner';

// --- NEW: Helper function to fix date/timezone bug ---
const formatDateForAPI = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
// --- END NEW ---

function StaffReport({ onNavigateToReport }) { 
    const [reportData, setReportData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState(() => {
        const date = new Date(); date.setDate(date.getDate() - 7); return date;
    });
    const [endDate, setEndDate] = useState(new Date());

    const fetchReport = async () => {
        setIsLoading(true);
        setReportData([]);

        // --- THIS IS THE DATE FIX ---
        const params = new URLSearchParams({
            startDate: formatDateForAPI(startDate), // Use new helper
            endDate: formatDateForAPI(endDate),     // Use new helper
        });
        // --- END DATE FIX ---

        try {
            const data = await apiCall(`report/staff-performance?${params.toString()}`);
            setReportData(data);
            if (data.length === 0) {
                toast.info("No staff activity found in the selected period.");
            }
        } catch (err) {
            console.error("Error fetching staff report:", err);
        } finally {
            setIsLoading(false);
        }
    };
    
    // (useEffect is unchanged)
    useEffect(() => {
        fetchReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    // (handleStaffClick is unchanged)
    const handleStaffClick = (staffName) => {
        if (!staffName || !onNavigateToReport) return;
        onNavigateToReport('reports', {
            identifier: staffName, 
            handledBy: 'all',      
            status: 'all',
            startDate: startDate,
            endDate: endDate,
            sourceType: 'staff' 
        });
        toast.info(`Showing Report filtered by staff: ${staffName}`);
    };

    // (Totals calculation is unchanged)
    const totalStaffActive = reportData.length;
    const totalCouponsRedeemed = reportData.reduce((sum, item) => sum + item.couponsRedeemed, 0);
    const totalValueRedeemed = reportData.reduce((sum, item) => sum + item.valueRedeemed, 0);

    // --- (Return/Render block is unchanged) ---
    return (
        <div className="report-page staff-report-page">
            <div className="card filter-card-layout">
                 <div className="card-header">
                     <h3>Staff Report Filters</h3>
                 </div>
                 <div className="card-body">
                    <div className="filter-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'}}>
                        <div className="form-group">
                            <label>Start Date</label>
                            <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} className="form-input" dateFormat="yyyy-MM-dd" />
                        </div>
                        <div className="form-group">
                            <label>End Date</label>
                            <DatePicker selected={endDate} onChange={(date) => setEndDate(date)} className="form-input" dateFormat="yyyy-MM-dd" />
                        </div>
                    </div>
                 </div>
                 <div className="card-footer" style={{justifyContent: 'flex-end'}}>
                     <button
                        className="tab-button active"
                        style={{padding: '10px 20px', fontSize: '1em'}}
                        onClick={fetchReport}
                        disabled={isLoading}
                    >
                        <FaCalendarAlt />
                        {isLoading ? "Searching..." : "Apply Date Filter"}
                    </button>
                </div>
            </div>
            
            <div className="summary-bar card">
                <div><strong>Total Staff Active:</strong> {totalStaffActive}</div>
                <div><strong>Total Coupons Redeemed:</strong> {totalCouponsRedeemed}</div>
                <div><strong>Total Value Redeemed:</strong> {totalValueRedeemed.toFixed(2)} rs</div>
            </div>
            
            <div className="card report-table-card">
                 {isLoading ? (
                     <LoadingSpinner message="Loading Staff Report..." />
                 ) : (
                      <div className="card-body table-container">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th><FaUser /> STAFF NAME</th>
                                    <th><FaCheckCircle /> COUPONS REDEEMED</th>
                                    <th><FaMoneyBillWave /> VALUE REDEEMED (RS)</th>
                                    <th><FaGift /> REDEEMED AS GIFT</th>
                                    <th><FaShoppingBag /> REDEEMED AS PURCHASE</th>
                                    <th><FaPlusSquare /> MANUAL COUPONS ADDED</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center text-muted">No staff activity found.</td></tr>
                                ) : (
                                    reportData.map((item, index) => (
                                        <tr key={index}>
                                            <td>
                                                <button 
                                                    className="clickable-name"
                                                    onClick={() => handleStaffClick(item.handledBy)} 
                                                >
                                                    {item.handledBy || 'System'}
                                                </button>
                                            </td>
                                            <td>{item.couponsRedeemed}</td>
                                            <td style={{textAlign: 'right'}}>{item.valueRedeemed.toFixed(2)}</td>
                                            <td>{item.redeemedAsGift}</td>
                                            <td>{item.redeemedAsPurchase}</td>
                                            <td>{item.manualCouponsCreated}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                 )}
            </div>
        </div>
    );
}

export default StaffReport;