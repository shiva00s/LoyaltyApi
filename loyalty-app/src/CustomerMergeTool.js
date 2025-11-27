import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FaUserTimes, FaLongArrowAltRight, FaExclamationTriangle, FaSearch, FaExchangeAlt } from 'react-icons/fa';
import AsyncSelect from 'react-select/async';
import debounce from 'lodash.debounce';
import { apiCall } from './ApiService';
import LoadingSpinner from './Components/LoadingSpinner';

// --- Customer Search Helper (Copied from App.js) ---
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
const loadOptions = debounce(fetchOptions, 300);
// --- End Customer Search Helper ---


function CustomerMergeTool({ onTransactionComplete }) {
    const [sourceCustomer, setSourceCustomer] = useState(null);
    const [targetCustomer, setTargetCustomer] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // Get logged-in user details for audit trail
    const loggedInUser = "AdminUser"; // Replace with actual user context in a real app

    const handleMerge = async () => {
        if (!sourceCustomer || !targetCustomer) {
            toast.error("Please select both a Source and a Target customer.");
            return;
        }
        if (sourceCustomer.value === targetCustomer.value) {
            toast.error("Source and Target must be different customers.");
            return;
        }

        if (!window.confirm(`WARNING: Are you sure you want to merge ALL coupons from ${sourceCustomer.label} (Source) into ${targetCustomer.label} (Target)? This cannot be undone!`)) {
            return;
        }

        setIsLoading(true);
        try {
            const body = {
                SourceCardNo: sourceCustomer.value,
                TargetCardNo: targetCustomer.value,
                MergedBy: loggedInUser 
            };

            const result = await apiCall('coupons/merge', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            toast.success(result.message || `Merge successful. ${result.couponsMoved} coupons moved.`);
            
            // Clear selection and trigger dashboard refresh
            setSourceCustomer(null);
            setTargetCustomer(null);
            if (onTransactionComplete) onTransactionComplete();

        } catch (err) {
            // apiCall handles error toast
            console.error("Merge failed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="report-page merge-tool-page">
            <div className="card merge-header-card">
                <div className="card-header">
                    <FaExchangeAlt />
                    <h3>Customer Merge Tool</h3>
                </div>
                <div className="card-body">
                    <p style={{color: '#ffc107', display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <FaExclamationTriangle /> 
                        **DANGER ZONE**: This action is irreversible. All coupons from the Source will be permanently transferred to the Target, and the Source record will be deleted from the local system.
                    </p>
                </div>
            </div>

            <div className="merge-selection-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
                
                {/* 1. Source Customer (The one to be deleted/merged FROM) */}
                <div className="card source-card">
                    <div className="card-header">
                        <FaUserTimes style={{color: '#dc3545'}}/>
                        <h4>Source Account (Delete FROM)</h4>
                    </div>
                    <div className="card-body">
                        <AsyncSelect
                            key="source-search"
                            classNamePrefix="merge-select"
                            cacheOptions
                            defaultOptions
                            loadOptions={loadOptions}
                            onChange={setSourceCustomer}
                            value={sourceCustomer}
                            placeholder="Search Source Card No..."
                            isClearable
                            isDisabled={isLoading}
                        />
                        {sourceCustomer && (
                            <div className="selected-info" style={{marginTop: '15px', padding: '10px', border: '1px solid #dc3545', borderRadius: '4px', backgroundColor: '#403030'}}>
                                <strong>Name:</strong> {sourceCustomer.label.split('(')[0].trim()}<br/>
                                <strong>Card:</strong> {sourceCustomer.value}
                            </div>
                        )}
                    </div>
                </div>

                {/* Arrow Separator */}
                <div style={{textAlign: 'center'}}>
                    <FaLongArrowAltRight style={{fontSize: '3em', color: '#007bff'}} />
                </div>

                {/* 2. Target Customer (The one to keep/merge INTO) */}
                <div className="card target-card">
                    <div className="card-header">
                         <FaSearch style={{color: '#28a745'}}/>
                        <h4>Target Account (Merge INTO)</h4>
                    </div>
                    <div className="card-body">
                        <AsyncSelect
                            key="target-search"
                            classNamePrefix="merge-select"
                            cacheOptions
                            defaultOptions
                            loadOptions={loadOptions}
                            onChange={setTargetCustomer}
                            value={targetCustomer}
                            placeholder="Search Target Card No..."
                            isClearable
                            isDisabled={isLoading}
                        />
                         {targetCustomer && (
                            <div className="selected-info" style={{marginTop: '15px', padding: '10px', border: '1px solid #28a745', borderRadius: '4px', backgroundColor: '#304030'}}>
                                <strong>Name:</strong> {targetCustomer.label.split('(')[0].trim()}<br/>
                                <strong>Card:</strong> {targetCustomer.value}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* 3. Action Button */}
            <div className="card merge-action-card" style={{marginTop: '30px', textAlign: 'center'}}>
                <button 
                    onClick={handleMerge}
                    className="tab-button active"
                    style={{padding: '15px 40px', fontSize: '1.2em', width: 'auto'}}
                    disabled={isLoading || !sourceCustomer || !targetCustomer || sourceCustomer.value === targetCustomer.value}
                >
                    {isLoading ? <LoadingSpinner message="Merging..." /> : "Execute Merge"}
                </button>
            </div>

            {isLoading && <LoadingSpinner message="Processing Merge..." />}
        </div>
    );
}

export default CustomerMergeTool;