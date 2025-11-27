import React, { useState, useMemo , useCallback} from 'react';
import { toast } from 'react-toastify';
import { FaPlus, FaUndo } from 'react-icons/fa'; // Removed unused icons
import AsyncSelect from 'react-select/async';
import debounce from 'lodash.debounce';
import './CustomerSearch.css';
import { apiCall } from './ApiService';

// --- Confirmation Modal Component (Unchanged) ---
function ConfirmationModal({ message, onConfirm, onCancel, item }) {
    return (
        <div className="modal-overlay">
            <div className="modal-content card">
                <h4>Confirm Action</h4>
                <p>{message}</p>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onCancel}>Cancel</button>
                    <button className="btn-confirm" onClick={() => onConfirm(item)}>Confirm</button>
                </div>
            </div>
        </div>
    );
}

// --- Manual Add Modal Component (Unchanged) ---
function ManualAddModal({ customer, staffList, onConfirm, onCancel }) {
    const [reason, setReason] = useState('');
    const [handledBy, setHandledBy] = useState('');

    const handleSubmit = () => {
        if (!reason || !handledBy) {
            toast.error("Please provide a reason and select 'Handled By'.");
            return;
        }
        onConfirm({ reason, handledBy });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content card" style={{minWidth: '400px'}}>
                <h4>Manually Add Coupon</h4>
                <p>For Customer: <strong>{customer.label}</strong></p>

                <div className="form-group" style={{margin: '15px 0'}}>
                    <label>Reason for Add:</label>
                    <input
                        type="text"
                        className="form-input"
                        style={{width: '100%'}}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Service gesture"
                    />
                </div>

                <div className="form-group" style={{margin: '15px 0'}}>
                    <label>Handled By:</label>
                    <select
                        className="form-select"
                        style={{width: '100%'}}
                        value={handledBy}
                        onChange={(e) => setHandledBy(e.target.value)}
                    >
                        <option value="">Select Staff...</option>
                        {staffList.map(staff => (
                            <option key={staff} value={staff}>{staff}</option>
                        ))}
                    </select>
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onCancel}>Cancel</button>
                    <button className="btn-confirm" onClick={handleSubmit}>Add Coupon</button>
                </div>
            </div>
        </div>
    );
}


function CustomerSearch({ onTransactionComplete, staffList }) {
  const [history, setHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [voidModal, setVoidModal] = useState({ isOpen: false, message: '', onConfirm: null, item: null });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleHistorySearch = async (customer) => {
    if (!customer) return;
    setIsLoading(true);
    setHistory(null);
    setSelectedCustomer(customer);

    try {
      const data = await apiCall(`report/customerhistory?identifier=${customer.value}`);
      // Ensure history is always an array, even if API returns a single object (which it shouldn't for this endpoint)
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistory([]); 
    }
    setIsLoading(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  }

  // Manual Add Logic (unchanged)
  const handleManualAdd = async (formData) => {
    setIsAddModalOpen(false);
    setIsLoading(true);
    try {
        const body = {
            CardNo: selectedCustomer.value,
            Reason: formData.reason,
            HandledBy: formData.handledBy
        };
        await apiCall('coupons/manual-add', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        toast.success("Coupon added successfully!");
        if (onTransactionComplete) onTransactionComplete();
        handleHistorySearch(selectedCustomer); // Refresh history
    } catch (err) {
        // apiCall handles error toast
    }
    setIsLoading(false);
  };

  // --- Void Logic (UPDATED) ---
  const handleVoid = async (coupon) => {
    closeVoidModal();
    setIsLoading(true);
    try {
        // Call the API
        const result = await apiCall(`coupons/void/${coupon.couponID}`, { // Make sure couponID is correct
            method: 'POST'
        });

        // Show standard success message
        toast.success(result.message || "Coupon voided successfully!");

        // --- NEW: Check for and show tier warning ---
        if (result.tierWarning) {
            toast.warn(result.tierWarning, { autoClose: 7000 }); // Show warning for longer
        }
        // --- END NEW ---

        if (onTransactionComplete) onTransactionComplete();
        handleHistorySearch(selectedCustomer); // Refresh history
    } catch (err) {
        // apiCall handles error toast
    }
    setIsLoading(false);
  };
  // --- END Void Logic ---

  // Modal open/close functions (unchanged)
  const openVoidModal = (coupon) => {
    setVoidModal({
        isOpen: true,
        message: `Are you sure you want to void this redeemed coupon (ID: ${coupon.couponID})? This will make it 'Pending' again.`, // Ensure couponID exists
        onConfirm: handleVoid,
        item: coupon
    });
  };
  const closeVoidModal = () => { setVoidModal({ isOpen: false, message: '', onConfirm: null, item: null }); };
  const openAddModal = () => { setIsAddModalOpen(true); };
  const closeAddModal = () => { setIsAddModalOpen(false); };

  // Autocomplete fetch function (unchanged)
 // --- DEBOUNCED loadOptions function (Primary target for fix) ---
  // --- DEBOUNCED loadOptions function (Primary target for fix) ---
  const fetchOptions = useCallback(async (inputValue) => {
    if (inputValue.length < 2) return [];
    try {
        // --- API CALL FOR AUTOCOMPLETE ---
        const data = await apiCall(`customer/autocomplete?query=${inputValue}`);

        // Ensure data is an array before mapping
        if (!Array.isArray(data)) {
             console.error("Autocomplete API returned non-array data:", data);
             return [];
        }

        return data.map(cust => ({
            value: cust.cardNo,
            label: `${cust.cName || 'N/A'} (${cust.cardNo || 'N/A'}) - ${cust.cContact || 'No Mobile'}`
        }));
    } catch (error) {
        // This catch handles network errors or errors thrown by apiCall
        console.error("Error during autocomplete fetch:", error);
        return [];
    }
  }, []); // <-- Add empty dependency array here

  // Use useMemo to create the debounced version ONCE
  const loadOptions = useMemo(() => debounce(fetchOptions, 300), [fetchOptions]);
  // --- END DEBOUNCED function ---


  return (
    <div className="customer-search-container">
      {voidModal.isOpen && <ConfirmationModal {...voidModal} onCancel={closeVoidModal} />}
      {isAddModalOpen && selectedCustomer && (
        <ManualAddModal
            customer={selectedCustomer}
            staffList={staffList}
            onConfirm={handleManualAdd}
            onCancel={closeAddModal}
        />
      )}

      {/* Search Bar (unchanged) */}
       <div className="card history-search-bar">
        <AsyncSelect
            className="autocomplete-select"
            cacheOptions
            defaultOptions
            loadOptions={loadOptions}
            onChange={handleHistorySearch}
            placeholder="Search & Select Customer..."            
            noOptionsMessage={() => "Type to search customers..."}
            isLoading={isLoading}
            value={selectedCustomer} // Control the selected value
        />
      </div>


      {/* --- Results Section (Minor Safety Updates) --- */}
      {history && ( // Check if history is not null (initial state)
        <div className="card history-results">
          {history.length > 0 ? (
            <>
              <div className="history-header">
                <h3>Transaction History for: {selectedCustomer?.label || '...'}</h3>
                {selectedCustomer && ( // Only show Add button if a customer is selected
                    <button className="btn-add" onClick={openAddModal}>
                        <FaPlus /> Manually Add Coupon
                    </button>
                )}
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction</th>
                    <th>Type</th>
                    <th>Handled By</th>
                    <th>Value (rs)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    // Use item.couponID which should be unique
                    <tr key={item.couponID}>
                      <td>{formatDate(item.dateRedeemed || item.dateCreated)}</td>
                      <td className={`status-${item.status?.toLowerCase() || 'unknown'}`}>{item.status || 'N/A'}</td>
                      <td>{item.claimType || '—'}</td>
                      <td>{item.handledBy || '—'}</td>
                      <td style={{textAlign: 'right'}}>{item.value?.toFixed(2) ?? '0.00'}</td>
                      <td style={{textAlign: 'center'}}>
                        {item.status === 'Redeemed' && item.couponID && ( // Check if couponID exists
                            <button className="btn-void" onClick={() => openVoidModal(item)}>
                                <FaUndo /> Void
                            </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="no-history">
                <h3>No History Found</h3>
                {selectedCustomer ? ( // Show message based on whether a customer was actually searched
                    <>
                        <p>This customer has no coupon activity yet.</p>
                        <button className="btn-add" onClick={openAddModal}>
                            <FaPlus /> Add First Coupon
                        </button>
                    </>
                 ) : (
                    <p>Select a customer above to view their history.</p>
                 )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomerSearch;