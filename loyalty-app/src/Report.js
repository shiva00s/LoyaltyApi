import React, { useState, useEffect, useCallback } from 'react'; // <-- ADD useCallback
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { FaUser, FaCheckCircle, FaGift, FaMoneyBillWave, FaUserTie, FaCalendarPlus, FaCalendarCheck, FaChartBar } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { apiCall } from './ApiService';
import './Report.css';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

const formatClaimType = (item) => {
    // ... (this function is unchanged) ...
    const pCount = item?.purchaseCount ?? 0;
    const gCount = item?.giftCount ?? 0;
    if (pCount === 0 && gCount === 0) return item?.claimType || '—';
    const parts = [];
    if (pCount > 0) parts.push(`P x${pCount}`);
    if (gCount > 0) parts.push(`G x${gCount}`);
    return parts.join(' | ');
};

function Report({ staffList = [], onCustomerSelect, initialFilters }) {
  const [reportData, setReportData] = useState({ items: [], totalCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({ count: 0, value: 0, label: 'Value on Page:' });
  const [startDate, setStartDate] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() - 30); return date;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState('Pending');
  const [claimType, setClaimType] = useState('all');
  const [handledBy, setHandledBy] = useState('all');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(100);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  // --- THIS IS THE FIX: Wrap prepareChartData in useCallback ---
  const prepareChartData = useCallback((items) => {
    const createdData = {};
    const redeemedData = {};
    items.forEach(item => {
        if (item.status !== 'Redeemed' && item.handledBy) {
            createdData[item.handledBy] = (createdData[item.handledBy] || 0) + (item.count || 0);
        }
        if (item.status === 'Redeemed') {
             redeemedData['Purchase'] = (redeemedData['Purchase'] || 0) + (item.purchaseCount || 0);
             redeemedData['Gift'] = (redeemedData['Gift'] || 0) + (item.giftCount || 0);
             if (item.claimType && item.claimType !== 'Gift' && item.claimType !== 'Purchase') {
                 redeemedData[item.claimType] = (redeemedData[item.claimType] || 0) + (item.count || 0);
             }
        }
    });
    const labels = [...new Set([...Object.keys(createdData), ...Object.keys(redeemedData)])];
    setChartData({
      labels: labels,
      datasets: [
        {
          label: 'Coupons Created',
          data: labels.map(label => createdData[label] || 0),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
        {
          label: 'Coupons Redeemed',
          data: labels.map(label => redeemedData[label] || 0),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
           borderColor: 'rgba(75, 192, 192, 1)',
           borderWidth: 1,
        },
      ],
    });
  }, []); // <-- Add empty dependency array
  // --- END FIX ---

  // --- THIS IS THE FIX: Wrap fetchReport in useCallback ---
  const fetchReport = useCallback(async (pageNum = 1) => {
    setIsLoading(true);
    setPageNumber(pageNum);

    const params = new URLSearchParams({
      startDate: formatDateForAPI(startDate),
      endDate: formatDateForAPI(endDate),
      identifier: identifier,
      status: status,
      claimType: claimType,
      handledBy: handledBy,
      pageNumber: pageNum,
      pageSize: pageSize
    });

    try {
      const data = await apiCall(`report/search?${params.toString()}`);
      const items = data.items || [];
      const totalCount = data.totalCount || 0;
      setReportData({ items: items, totalCount: totalCount });

      let newLabel = 'Value on Page:';
      if (status === 'Pending') newLabel = 'Pending Value on Page:';
      if (status === 'Redeemed') newLabel = 'Redeemed Value on Page:';
      if (status === 'Expired') newLabel = 'Expired Value on Page:';
      const pageValue = items.reduce((sum, item) => sum + (item.value || 0), 0);
      const pageCoupons = items.reduce((sum, item) => sum + (item.count || 0), 0);
      setSummary({ count: pageCoupons, value: pageValue, label: newLabel });
      prepareChartData(items);
      if (items.length === 0 && pageNum === 1) {
        toast.info("No coupon groups found matching your criteria.");
      }

    } catch (err) {
      setSummary({ count: 0, value: 0, label: 'Total Value:' });
      setReportData({ items: [], totalCount: 0 });
      setChartData({ labels: [], datasets: [] });
    } finally {
        setIsLoading(false);
    }
  }, [startDate, endDate, identifier, status, claimType, handledBy, pageSize, prepareChartData]); // <-- Add dependencies
  // --- END FIX ---


  // --- THIS IS THE FIX: Add fetchReport as a dependency ---
  useEffect(() => {
    if (initialFilters) {
        if (initialFilters.sourceType === 'staff') {
            setHandledBy(initialFilters.identifier || 'all'); 
            setIdentifier(''); 
        } else {
            setIdentifier(initialFilters.identifier || '');
            setHandledBy(initialFilters.handledBy || 'all'); 
        }
        setStatus(initialFilters.status || 'all');
        setClaimType(initialFilters.claimType || 'all');
        fetchReport(1); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilters, fetchReport]); // <-- Add fetchReport
  // --- END FIX ---

  // --- THIS IS THE FIX: Change dependency array to fetchReport ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
        fetchReport(1);
    }, 500); 
    return () => clearTimeout(delayDebounceFn);
  }, [fetchReport]); // <-- Change to this
  // --- END FIX ---

  // (Pagination and helper functions are unchanged)
   const goToPage = (pageNum) => { if (pageNum !== pageNumber) fetchReport(pageNum); };
   const handleNextPage = () => {
        const totalPages = Math.ceil(reportData.totalCount / pageSize);
        if (pageNumber < totalPages) {
            goToPage(pageNumber + 1);
        }
    };
    const handlePreviousPage = () => {
        if (pageNumber > 1) {
            goToPage(pageNumber - 1);
        }
    };
   const totalPages = Math.ceil(reportData.totalCount / pageSize);
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    try {
        return new Date(dateString).toLocaleDateString('en-US', options);
    } catch (e) {
        return "Invalid Date";
    }
  };
  const handleCustomerClick = (cardNo, cName, cContact) => {
     if (onCustomerSelect && cardNo) {
      onCustomerSelect({
        value: cardNo,
        label: `${cName || 'N/A'} | Card: ${cardNo} | Mob: ${cContact || 'N/A'}`
      });
    } else if (!onCustomerSelect){
      console.error("onCustomerSelect function was not passed to Report component");
      toast.error("Navigation function not available.");
    }
  };
   const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top', },
            title: { display: true, text: 'Coupon Activity on Current Page' } ,
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
             x: { stacked: true },
             y: { stacked: true, beginAtZero: true }
        }
   };
  const handleClearAllFilters = () => {
    setStartDate(() => {
        const date = new Date(); 
        date.setDate(date.getDate() - 30); 
        return date;
    });
    setEndDate(new Date());
    setIdentifier('');
    setStatus('all');
    setClaimType('all');
    setHandledBy('all');
    setPageNumber(1);
  };

  // (Return/Render block is unchanged)
  return (
    <div className="report-page">
      <div className="card filter-card-layout">
        <div className="card-header">
            <h3>Report Filters</h3>
            <button
            className="tab-button"
            style={{ padding: '8px 15px', fontSize: '0.9em' }}
            onClick={handleClearAllFilters}
            disabled={isLoading}
        >
            <FaCheckCircle /> Clear All Filters
        </button>
        </div>
        <div className="card-body">
            <div className="filter-grid">
                <div className="form-group">
                    <label>Start Date</label>
                    <DatePicker
                        selected={startDate}
                        onChange={(date) => setStartDate(date)}
                        className="form-input"
                        dateFormat="yyyy-MM-dd"
                    />
                </div>
                <div className="form-group">
                    <label>End Date</label>
                    <DatePicker
                        selected={endDate}
                        onChange={(date) => setEndDate(date)}
                        className="form-input"
                        dateFormat="yyyy-MM-dd"
                    />
                </div>
                 <div className="form-group">
                    <label>Search (Card/Name/Mobile)</label>
                    <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g., John Doe"
                        className="form-input"
                    />
                </div>
                 <div className="form-group">
                    <label>Status</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="form-select"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Redeemed">Redeemed</option>
                        <option value="Expired">Expired</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Claim Type</label>
                    <select
                        value={claimType}
                        onChange={(e) => setClaimType(e.target.value)}
                        className="form-select"
                    >
                        <option value="all">All Types</option>
                        <option value="Purchase">Purchase</option>
                        <option value="Gift">Gift</option>
                        <option value="Manual Add">Manual Add</option>
                        <option value="Voided">Voided</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Handled By</label>
                    <select
                        value={handledBy}
                        onChange={(e) => setHandledBy(e.target.value)}
                        className="form-select"
                    >
                        <option value="all">All Staff</option>
                        <option value="System">System</option>
                        {staffList.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                    </select>
                </div>
            </div>
        </div>
      </div>
      
      <div className="summary-bar card">
        <div><strong>Coupons on Page:</strong> {summary.count}</div>
        <div><strong>{summary.label}</strong> {summary.value.toFixed(2)} rs</div>
        <div><strong>Total Found:</strong> {reportData.totalCount}</div>
      </div>

      <div className="card report-table-card">
        <div className="card-body table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th><FaUser /> Customer</th>
                <th><FaCheckCircle /> Status</th>
                <th><FaGift /> Type (P|G)</th>
                <th>Count</th>
                <th><FaMoneyBillWave /> Total Value (rs)</th>
                <th><FaUserTie /> HandledBy</th>
                <th><FaCalendarPlus /> Date Created</th>
                <th><FaCalendarCheck /> Date Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="loading-row">
                    <div className="loading-spinner" style={{ padding: '30px 0'}}>
                      <div className="dot1"></div> <div className="dot2"></div> <div className="dot3"></div>
                    </div>
                  </td>
                </tr>
              ) : reportData.items.length === 0 ? (
                 <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#a0a5b1' }}>
                        No results found for the current filters.
                    </td>
                 </tr>
              ) : (
                reportData.items.map((item, index) => (
                      <tr key={`${item.cardNo}-${item.dateCreated}-${index}`}>
                        <td>
                            <button
                              className="clickable-name"
                              onClick={() => handleCustomerClick(item.cardNo, item.cName, item.cContact)}
                              title={`Card: ${item.cardNo || 'N/A'}\nContact: ${item.cContact || 'N/A'}`}
                            >
                               {item.cName || item.cardNo || 'N/A'}
                            </button>
                        </td>
                        <td className={`status-${item.status?.toLowerCase() || 'unknown'}`}>{item.status || 'N/A'}</td>
                        <td>{formatClaimType(item)}</td>
                        <td style={{ fontWeight: '600' }}>{item.count ?? '?'}</td>
                        <td style={{ textAlign: 'right' }}>{item.value?.toFixed(2) ?? '0.00'} rs</td>
                        <td>{item.handledBy || '—'}</td>
                        <td>{formatDate(item.dateCreated)}</td>
                        <td>{item.status === 'Redeemed' ? formatDate(item.dateRedeemed) : '—'}</td>
                      </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {reportData.totalCount > pageSize && (
            <div className="pagination-controls card-footer">
                <span>
                    Page {pageNumber} of {totalPages} ({reportData.totalCount} items)
                </span>
                <div>
                    <button onClick={handlePreviousPage} disabled={pageNumber <= 1 || isLoading} className="btn-paginate">
                        Previous
                    </button>
                    <button onClick={handleNextPage} disabled={pageNumber >= totalPages || isLoading} className="btn-paginate">
                        Next
                    </button>
                </div>
            </div>
        )}
      </div>
      <div className="report-graph-bottom">
          {reportData.items.length > 0 && !isLoading && (
              <div className="card chart-card" style={{ padding: '15px' }}>
                    <div className="card-header">
                        <h3><FaChartBar /> Activity Summary (Page {pageNumber})</h3>
                    </div>
                    <div style={{ maxHeight: '300px' }}>
                        <Bar options={chartOptions} data={chartData} />
                    </div>
              </div>
          )}
          {reportData.items.length === 0 && !isLoading && (
              <div className="card chart-card" style={{ padding: '15px' }}>
                 <div className="card-header">
                    <h3><FaChartBar /> Activity Summary</h3>
                 </div>
                 <p style={{textAlign: 'center', padding: '20px', color: '#a0a5b1'}}>
                    No data to display in chart.
                 </p>
              </div>
          )}
      </div>
    </div>
  );
}
export default Report;