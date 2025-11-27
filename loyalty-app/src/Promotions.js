import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import './Promotions.css';
import { apiCall } from './ApiService'; // <-- Uses the secure wrapper

// --- This is the modal for Creating/Editing a promotion ---
function PromotionModal({ promotion, onSave, onCancel, onRefreshComplete }) {
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [couponValue, setCouponValue] = useState(300);
    const [isEnabled, setIsEnabled] = useState(true);

    const isEditing = promotion && promotion.promotionID;

    useEffect(() => {
        if (isEditing) {
            setName(promotion.name);
            setStartDate(new Date(promotion.startDate));
            setEndDate(new Date(promotion.endDate));
            setCouponValue(promotion.couponValue);
            setIsEnabled(promotion.isEnabled);
        } else {
            const start = new Date();
            const end = new Date();
            end.setDate(start.getDate() + 7);
            setStartDate(start);
            setEndDate(end);
        }
    }, [promotion, isEditing]);

    const handleSubmit = async () => {
        if (!name || !couponValue) {
            toast.error("Please fill in all fields.");
            return;
        }
        if (endDate <= startDate) {
            toast.error("End Date must be after Start Date.");
            return;
        }

        const newPromotion = {
            promotionID: isEditing ? promotion.promotionID : 0,
            name,
            startDate,
            endDate,
            couponValue: parseFloat(couponValue),
            isEnabled
        };

        const endpoint = isEditing 
            ? `promotions/${promotion.promotionID}` 
            : `promotions`;
            
        const method = isEditing ? 'PUT' : 'POST';

        try {
            // --- USE APICALL FOR SAVE/UPDATE ---
            await apiCall(endpoint, {
                method: method,
                body: JSON.stringify(newPromotion)
            });

            toast.success(`Promotion ${isEditing ? 'updated' : 'created'}!`);
            if (onRefreshComplete) onRefreshComplete();
            onSave();
        } catch (err) {
            // apiCall handles the toast
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content card" style={{ minWidth: '500px' }}>
                <h4>{isEditing ? 'Edit Promotion' : 'Create New Promotion'}</h4>
                
                <div className="form-group">
                    <label>Promotion Name:</label>
                    <input 
                        type="text"
                        className="form-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Diwali 2025 Sale"
                    />
                </div>

                <div className="form-group-row">
                    <div className="form-group">
                        <label>Start Date:</label>
                        <DatePicker 
                            selected={startDate} 
                            onChange={(date) => setStartDate(date)} 
                            className="form-input"
                            dateFormat="yyyy-MM-dd"
                        />
                    </div>
                    <div className="form-group">
                        <label>End Date:</label>
                        <DatePicker 
                            selected={endDate} 
                            onChange={(date) => setEndDate(date)} 
                            className="form-input"
                            dateFormat="yyyy-MM-dd"
                        />
                    </div>
                </div>

                <div className="form-group-row">
                    <div className="form-group">
                        <label>Coupon Value (in rs):</label>
                        <input 
                            type="number"
                            className="form-input"
                            value={couponValue}
                            onChange={(e) => setCouponValue(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Status:</label>
                        <button 
                            className={`toggle-btn ${isEnabled ? 'enabled' : ''}`}
                            onClick={() => setIsEnabled(!isEnabled)}
                        >
                            {isEnabled ? <FaToggleOn /> : <FaToggleOff />}
                            {isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onCancel}>Cancel</button>
                    <button className="btn-confirm" onClick={handleSubmit}>
                        {isEditing ? 'Save Changes' : 'Create Promotion'}
                    </button>
                </div>
            </div>
        </div>
    );
}


function Promotions({ onSaveComplete }) {
    const [promotions, setPromotions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState(null);

    const fetchPromotions = async () => {
        setIsLoading(true);
        try {
            // --- USE APICALL FOR FETCH ---
            const data = await apiCall('promotions');
            setPromotions(data);
        } catch (err) {
            // apiCall handles the error toast
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    const handleOpenModal = (promo) => {
        setEditingPromotion(promo);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPromotion(null);
    };

    const handleSave = () => {
        handleCloseModal();
        fetchPromotions(); 
        if (onSaveComplete) onSaveComplete();
    };

    const handleDelete = async (promoId) => {
        if (!window.confirm("Are you sure you want to delete this promotion?")) {
            return;
        }
        try {
            // --- USE APICALL FOR DELETE ---
            await apiCall(`promotions/${promoId}`, {
                method: 'DELETE'
            });
            
            toast.success("Promotion deleted.");
            fetchPromotions();
            if (onSaveComplete) onSaveComplete();
        } catch (err) {
            // apiCall handles the error toast
        }
    };
    
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        });
    }

    return (
        <div className="report-page promotions-page">
            {isModalOpen && (
                <PromotionModal 
                    promotion={editingPromotion}
                    onSave={handleSave}
                    onCancel={handleCloseModal}
                    onRefreshComplete={onSaveComplete}
                />
            )}
        
            <div className="promotions-header">
                <h2>Manage Promotions</h2>
                <button 
                    className="tab-button active" 
                    onClick={() => handleOpenModal(null)}
                >
                    <FaPlus /> Create New
                </button>
            </div>

            <div className="card report-table-card">
                <div className="card-body table-container"> 
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Promotion Name</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Coupon Value</th>
                                <th>Actions</th>
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
                            ) : promotions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#a0a5b1' }}>
                                        No promotions found. Click "Create New" to start.
                                    </td>
                                </tr>
                            ) : (
                                promotions.map((promo) => (
                                    <tr key={promo.promotionID}>
                                        <td>
                                            <span className={`status-badge ${promo.isEnabled ? 'enabled' : 'disabled'}`}>
                                                {promo.isEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td><strong>{promo.name}</strong></td>
                                        <td>{formatDate(promo.startDate)}</td>
                                        <td>{formatDate(promo.endDate)}</td>
                                        <td style={{ textAlign: 'right' }}>{promo.couponValue.toFixed(2)} rs</td>
                                        <td className="actions-cell">
                                            <button className="btn-edit" onClick={() => handleOpenModal(promo)}>
                                                <FaEdit /> Edit
                                            </button>
                                            <button className="btn-delete" onClick={() => handleDelete(promo.promotionID)}>
                                                <FaTrash /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Promotions;