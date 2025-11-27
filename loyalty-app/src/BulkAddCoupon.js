import React, { useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { FaPlusSquare, FaCalendarAlt, FaMoneyBillWave, FaUsers, FaUserTie, FaPlus, FaTrash, FaHashtag } from 'react-icons/fa';
import { apiCall } from './ApiService';
import AsyncSelect from 'react-select/async';
import debounce from 'lodash.debounce';
import './BulkAddCoupon.css'; 

// --- Customer Search Helper ---
const fetchOptions = async (inputValue) => {
    if (inputValue.length < 2) return [];
    try {
        const suggestions = await apiCall(`customer/autocomplete?query=${inputValue}`);
        if (!Array.isArray(suggestions)) return []; 
        
        return suggestions.map(s => ({
            value: s.cardNo,
            label: `${s.cName || 'N/A'} (${s.cardNo || 'N/A'}) - ${s.cContact || 'No Mobile'}`
        }));
    } catch (error) {
        return [];
    }
};
// --- End Customer Search Helper ---

// --- THIS IS THE FIX: Added CouponCount ---
const initialRequestState = {
    CouponValue: 300,
    ExpiryDays: 90,
    CouponCount: 1, // <-- ADDED THIS
    ClaimType: 'Promotion: General',
    HandledBy: '',
    CardNos: null
};

function BulkAddCoupon({ staffList, onTransactionComplete }) {
    const [requestData, setRequestData] = useState(initialRequestState);
    const [isLoading, setIsLoading] = useState(false);
    
    const [selectedCustomer, setSelectedCustomer] = useState(null); 
    const [customerList, setCustomerList] = useState([]); 

    // --- THIS IS THE FIX: 'useMemo' is now inside the component ---
    const loadOptions = useMemo(() => debounce(fetchOptions, 300), []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setRequestData(prev => ({
            ...prev,
            [name]: (name === 'CouponValue' || name === 'ExpiryDays' || name === 'CouponCount') ? Number(value) : value
        }));
    };

    const handleAddCustomer = () => {
        if (!selectedCustomer) {
            toast.error("Please select a customer from the search bar first.");
            return;
        }
        if (customerList.find(c => c.value === selectedCustomer.value)) {
            toast.warn("This customer is already in the list.");
            setSelectedCustomer(null); 
            return;
        }
        setCustomerList(prev => [...prev, selectedCustomer]);
        setSelectedCustomer(null); 
    };

    const handleRemoveCustomer = (cardNo) => {
        setCustomerList(prev => prev.filter(c => c.value !== cardNo));
    };

    const handleSubmit = async () => {
        if (requestData.CouponValue <= 0 || requestData.ExpiryDays <= 0 || requestData.CouponCount <= 0) {
            toast.error("Value, Expiry Days, and Coupon Count must be greater than zero.");
            return;
        }
        if (!requestData.HandledBy) {
            toast.error("Please select a staff member who handled this.");
            return;
        }
        if (customerList.length === 0) {
            toast.error("Please add at least one customer to the list.");
            return;
        }

        setIsLoading(true);
        const finalCardNos = customerList.map(c => c.value);

        try {
            const body = {
                ...requestData,
                CardNos: finalCardNos,
                CouponValue: Number(requestData.CouponValue),
                ExpiryDays: Number(requestData.ExpiryDays),
                CouponCount: Number(requestData.CouponCount) // <-- ADDED THIS
            };

            const result = await apiCall('coupons/bulk-add', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            toast.success(result.message || `Success! Added ${result.count} coupons.`);
            if (onTransactionComplete) onTransactionComplete(); 
            setRequestData(initialRequestState);
            setCustomerList([]); 

        } catch (err) {
            // apiCall handles error toast
        } finally {
            setIsLoading(false);
        }
    };

    const customerCount = customerList.length;

    return (
        <div className="report-page bulk-add-page">
            <div className="card filter-card-layout">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ flexGrow: 1, margin: 0 }}> 
                        <FaPlusSquare style={{ marginRight: '10px' }} /> 
                        Bulk Coupon Issuance
                    </h3>
                    <button
                        className="tab-button active"
                        style={{ padding: '10px 20px', fontSize: '1em', flexShrink: 0 }}
                        onClick={handleSubmit}
                        disabled={isLoading || customerList.length === 0 || !requestData.HandledBy}
                    >
                        <FaPlusSquare />
                        {isLoading ? "Processing..." : `Issue Coupons`}
                    </button>
                </div>
                <div className="card-body">
                    <div className="filter-grid" style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
                        
                        {/* Column 1: Coupon Details */}
                        <div className="form-column">
                            <h4>Coupon Details</h4>
                            <div className="form-group">
                                <label><FaMoneyBillWave /> Coupon Value (rs)</label>
                                <input type="number" name="CouponValue" value={requestData.CouponValue} onChange={handleInputChange} className="form-input" disabled={isLoading} min="1"/>
                            </div>
                            <div className="form-group">
                                <label><FaCalendarAlt /> Expiry Days (from today)</label>
                                <input type="number" name="ExpiryDays" value={requestData.ExpiryDays} onChange={handleInputChange} className="form-input" disabled={isLoading} min="1"/>
                            </div>
                            <div className="form-group">
                                <label><FaHashtag /> Number of Coupons (per customer)</label>
                                <input type="number" name="CouponCount" value={requestData.CouponCount} onChange={handleInputChange} className="form-input" disabled={isLoading} min="1"/>
                            </div>                            
                        </div>
                        
                        {/* Column 2: Recipients */}
                        <div className="form-column">
                            <h4>Recipients & Handler</h4>
                            <div className="form-group">
                                <label>Claim Type / Promotion Name</label>
                                <input type="text" name="ClaimType" value={requestData.ClaimType} onChange={handleInputChange} className="form-input" disabled={isLoading} placeholder="e.g., Summer Promotion 2026"/>
                            </div>
                             <div className="form-group">
                                <label><FaUserTie /> Handled By</label>
                                <select name="HandledBy" value={requestData.HandledBy} onChange={handleInputChange} className="form-select" disabled={isLoading}>
                                    <option value="">Select Staff...</option>
                                    {staffList.map(staff => (
                                        <option key={staff} value={staff}>{staff}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label><FaUsers /> Target Customers</label>
                                <div className="customer-list-builder">
                                    <AsyncSelect
                                        key={selectedCustomer} 
                                        className="customer-search-select"
                                        classNamePrefix="header-select"
                                        cacheOptions
                                        defaultOptions
                                        loadOptions={loadOptions}
                                        onChange={setSelectedCustomer}
                                        value={selectedCustomer}
                                        placeholder="Search Customer Card/Mobile..."
                                        isClearable
                                        isDisabled={isLoading}
                                    />
                                    <button 
                                        className="tab-button" 
                                        onClick={handleAddCustomer}
                                        disabled={isLoading || !selectedCustomer}
                                    >
                                        <FaPlus /> Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Customer List */}
                        <div className="form-column">
                           <div className="selected-customer-list" style={{height: '100%'}}>
                                <div className="card-header" style={{padding: '10px 15px'}}>
                                    <strong>{customerCount} Customers in List</strong>
                                </div>
                                <div className="card-body scrollable-list" style={{maxHeight: '320px', padding: '0'}}>
                                    {customerCount === 0 ? (
                                        <p style={{padding: '15px', color: '#a0a5b1'}}>No customers added yet.</p>
                                    ) : (
                                        customerList.map(cust => (
                                            <div key={cust.value} className="customer-list-item">
                                                <span>{cust.label}</span>
                                                <button 
                                                    className="btn-delete"
                                                    onClick={() => handleRemoveCustomer(cust.value)}
                                                    disabled={isLoading}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BulkAddCoupon;