import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { apiCall } from './ApiService';
import LoadingSpinner from './Components/LoadingSpinner';
import './StaffManagement.css'; // We will create this file next

function StaffManagement() {
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(null); // Tracks which staff ID is being updated

    // Function to fetch all staff (active and inactive)
    const fetchAllStaff = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiCall('staffmanagement');
            setStaffList(data || []);
        } catch (err) {
            // apiCall handles error toast
            setStaffList([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch staff on initial load
    useEffect(() => {
        fetchAllStaff();
    }, [fetchAllStaff]);

    // Function to handle toggle click
    const handleToggle = async (staffMember) => {
        setIsUpdating(staffMember.staffID); // Lock this specific toggle

        const updatedStaff = {
            ...staffMember,
            isActive: !staffMember.isActive // Flip the status
        };

        try {
            await apiCall(`staffmanagement/${staffMember.staffID}`, {
                method: 'PUT',
                body: JSON.stringify(updatedStaff)
            });
            
            toast.success(`'${staffMember.staffName}' is now ${updatedStaff.isActive ? 'Active' : 'Inactive'}.`);
            
            // Update the list in the UI instantly
            setStaffList(prevList =>
                prevList.map(s =>
                    s.staffID === staffMember.staffID ? updatedStaff : s
                )
            );

        } catch (err) {
            // apiCall handles error toast
            console.error("Failed to update staff status", err);
        } finally {
            setIsUpdating(null); // Unlock the toggle
        }
    };


    return (
        <div className="report-page staff-management-page">
            <div className="card report-table-card">
                 <div className="card-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
                     <h3>Staff Management</h3>
                 </div>
                <div className="card-body table-container">
                    {isLoading ? (
                        <LoadingSpinner message="Loading staff..." />
                    ) : (
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Staff Name</th>
                                    <th>Status</th>
                                    <th>Action (Enable/Disable)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffList.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#a0a5b1' }}>
                                            No staff members found.
                                        </td>
                                    </tr>
                                ) : (
                                    staffList.map((staff) => (
                                        <tr key={staff.staffID}>
                                            <td><strong>{staff.staffName}</strong></td>
                                            <td>
                                                <span className={`status-badge ${staff.isActive ? 'enabled' : 'disabled'}`}>
                                                    {staff.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="actions-cell">
                                                <button
                                                    className={`toggle-btn ${staff.isActive ? 'enabled' : ''}`}
                                                    onClick={() => handleToggle(staff)}
                                                    disabled={isUpdating === staff.staffID} // Disable only the one being updated
                                                >
                                                    {staff.isActive ? <FaToggleOn /> : <FaToggleOff />}
                                                    {staff.isActive ? 'Enabled' : 'Disabled'}
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

export default StaffManagement;