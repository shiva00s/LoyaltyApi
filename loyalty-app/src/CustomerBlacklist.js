import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FaUserSlash, FaUndo, FaExclamationTriangle } from 'react-icons/fa';
import AsyncSelect from 'react-select/async';
import debounce from 'lodash.debounce';
import { apiCall } from './ApiService';
import LoadingSpinner from './Components/LoadingSpinner';
import './CustomerBlacklist.css'; // We will create this file next

// --- Customer Search Helper (Copied from App.js) ---
const fetchOptions = async (inputValue) => {
    if (inputValue.length < 2) return [];
    try {
        // This hits the autocomplete endpoint, which already filters out blacklisted users
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
const loadOptions = debounce(fetchOptions, 300);
// --- End Customer Search Helper ---

function CustomerBlacklist() {
    const [blacklist, setBlacklist] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Function to fetch the list of blacklisted customers
    const fetchBlacklist = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiCall('customerblacklist');
            setBlacklist(data || []);
        } catch (err) {
            // apiCall handles error
        }
        setIsLoading(false);
    }, []);

    // Load blacklist on component mount
    useEffect(() => {
        fetchBlacklist();
    }, [fetchBlacklist]);

    // Handle adding a customer to the blacklist
    const handleAddToBlacklist = async () => {
        if (!selectedCustomer) {
            toast.error("Please select a customer to blacklist.");
            return;
        }

        if (!window.confirm(`Are you sure you want to BLACKLIST '${selectedCustomer.label}'? They will not be able to redeem or earn new coupons.`)) {
            return;
        }

        setIsUpdating(true);
        try {
            await apiCall('customerblacklist', {
                method: 'POST',
                body: JSON.stringify({ CardNo: selectedCustomer.value })
            });
            toast.success(`Customer '${selectedCustomer.label}' has been blacklisted.`);
            setSelectedCustomer(null); // Clear selection
            fetchBlacklist(); // Refresh the list
        } catch (err) {
            // apiCall handles error
        }
        setIsUpdating(false);
    };

    // Handle removing a customer (re-enabling)
    const handleRemoveFromBlacklist = async (customer) => {
        if (!window.confirm(`Are you sure you want to RE-ENABLE '${customer.cName} (${customer.cardNo})'?`)) {
            return;
        }

        setIsUpdating(true);
        try {
            await apiCall(`customerblacklist/${customer.cardNo}`, {
                method: 'DELETE'
            });
            toast.success(`Customer '${customer.cName}' has been re-enabled.`);
            fetchBlacklist(); // Refresh the list
        } catch (err) {
            // apiCall handles error
        }
        setIsUpdating(false);
    };

    return (
        <div className="report-page blacklist-page">

            {/* --- Top Card: Add to Blacklist --- */}
            <div className="card add-blacklist-card">
                <div className="card-header">
                    <h3><FaUserSlash /> Add Customer to Blacklist</h3>
                </div>
                <div className="card-body">
                    <p style={{color: '#ffc107', display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <FaExclamationTriangle /> 
                        Blacklisted customers cannot be searched, viewed, or redeem coupons, and will not earn new coupons.
                    </p>
                    <div className="add-blacklist-form">
                        <AsyncSelect
                            key="blacklist-search"
                            classNamePrefix="blacklist-select"
                            cacheOptions
                            defaultOptions
                            loadOptions={loadOptions}
                            onChange={setSelectedCustomer}
                            value={selectedCustomer}
                            placeholder="Search for a customer to blacklist..."
                            isClearable
                            isDisabled={isUpdating}
                            className="blacklist-search-bar"
                        />
                        <button
                            className="tab-button active"
                            onClick={handleAddToBlacklist}
                            disabled={!selectedCustomer || isUpdating}
                        >
                            {isUpdating ? "Blacklisting..." : "Add to Blacklist"}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Bottom Card: Current Blacklist --- */}
            <div className="card report-table-card" style={{marginTop: '20px'}}>
                <div className="card-header">
                    <h3>Current Blacklist</h3>
                </div>
                <div className="card-body table-container">
                    {isLoading ? (
                        <LoadingSpinner message="Loading blacklist..." />
                    ) : (
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Card Number</th>
                                    <th>Contact</th>
                                    <th style={{width: '150px'}}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blacklist.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#a0a5b1' }}>
                                            The blacklist is currently empty.
                                        </td>
                                    </tr>
                                ) : (
                                    blacklist.map((cust) => (
                                        <tr key={cust.cardNo}>
                                            <td><strong>{cust.cName || 'N/A'}</strong></td>
                                            <td>{cust.cardNo}</td>
                                            <td>{cust.cContact || 'N/A'}</td>
                                            <td className="actions-cell">
                                                <button
                                                    className="btn-void" // Re-using 'btn-void' style
                                                    onClick={() => handleRemoveFromBlacklist(cust)}
                                                    disabled={isUpdating}
                                                >
                                                    <FaUndo /> Re-Enable
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CustomerBlacklist;