import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FaEdit, FaSave, FaTimes, FaUndo, FaKey, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { apiCall } from './ApiService';
import LoadingSpinner from './Components/LoadingSpinner'; // Import LoadingSpinner
import './UserManagement.css'; // We'll create this CSS file next

// Modal for editing user details
function UserEditModal({ user, onSave, onCancel }) {
    const [role, setRole] = useState(user.role);
    const [isActive, setIsActive] = useState(user.isActive);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (newPassword && newPassword !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }
        if (newPassword && newPassword.length < 6) {
             toast.error("New password must be at least 6 characters long.");
            return;
        }

        setIsSaving(true);
        try {
            const updateData = {
                userID: user.userID,
                role: role,
                isActive: isActive,
                // Only include newPassword if it's actually set
                ...(newPassword && { newPassword: newPassword })
            };

            await apiCall(`Auth/users/${user.userID}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            toast.success(`User '${user.username}' updated successfully.`);
            onSave(); // Close modal and refresh list in parent
        } catch (err) {
            // apiCall handles error toast
            console.error("Failed to update user", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content card" style={{ minWidth: '450px' }}>
                <h4>Edit User: {user.username} ({user.staffName})</h4>

                <div className="form-group">
                    <label>Role:</label>
                    <select
                        className="form-select"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        disabled={isSaving}
                    >
                        <option value="Staff">Staff</option>
                        <option value="Admin">Admin</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Status:</label>
                    <button
                        className={`toggle-btn ${isActive ? 'enabled' : ''}`}
                        onClick={() => setIsActive(!isActive)}
                        disabled={isSaving}
                    >
                        {isActive ? <FaToggleOn /> : <FaToggleOff />}
                        {isActive ? 'Active' : 'Inactive'}
                    </button>
                    <p style={{fontSize: '0.9em', color: '#a0a5b1', marginTop: '5px'}}>
                        Inactive users cannot log in.
                    </p>
                </div>

                 <hr style={{margin: '20px 0'}} />

                <div className="form-group">
                     <label><FaKey /> Reset Password (Optional):</label>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="Enter New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={isSaving}
                    />
                     <input
                        type="password"
                        className="form-input"
                        placeholder="Confirm New Password"
                        style={{marginTop: '10px'}}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isSaving}
                    />
                     <p style={{fontSize: '0.9em', color: '#a0a5b1', marginTop: '5px'}}>
                        Leave blank to keep the current password. Min 6 characters.
                    </p>
                </div>


                <div className="modal-actions">
                    <button className="btn-cancel" onClick={onCancel} disabled={isSaving}>
                       <FaTimes /> Cancel
                    </button>
                    <button className="btn-confirm" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <FaUndo className="spin" /> : <FaSave />} Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}


function UserManagement() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null); // State to control the modal

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiCall('Auth/users');
            setUsers(data || []); // Ensure users is always an array
        } catch (err) {
            // apiCall handles error toast
            setUsers([]); // Reset on error
        } finally {
            setIsLoading(false);
        }
    }, []); // No dependencies needed if apiCall is stable

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleEditClick = (user) => {
        setEditingUser(user);
    };

    const handleCloseModal = () => {
        setEditingUser(null);
    };

    const handleSaveComplete = () => {
        setEditingUser(null);
        fetchUsers(); // Refresh the list after saving
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        } catch {
            return "Invalid Date";
        }
    };

    // --- NEW: Delete Logic ---
    const handleDelete = async (user) => {
        if (!window.confirm(`WARNING: Are you sure you want to permanently delete the account for ${user.staffName}?`)) {
            return;
        }

        setIsLoading(true); // Set loading for the whole list refresh
        try {
            // Note: apiCall now handles 204 (NoContent) status codes correctly
            await apiCall(`Auth/users/delete/${user.userID}`, {
                method: 'DELETE'
            });
            toast.success(`User '${user.staffName}' deleted successfully.`);
            fetchUsers(); // Refresh the list
        } catch (err) {
            // apiCall handles error toast
        } finally {
            // We keep isLoading true until fetchUsers completes to prevent flicker
        }
    };
    // --- END NEW ---

   return (
        <div className="report-page user-management-page">
            {editingUser && (
                <UserEditModal
                    user={editingUser}
                    onSave={handleSaveComplete}
                    onCancel={handleCloseModal}
                />
            )}

            {/* If loading, show spinner over the whole area */}
            {isLoading && <LoadingSpinner message="Loading users..." />}

            <div className="card report-table-card" style={{ opacity: isLoading ? 0.5 : 1 }}>
                 <div className="card-header">
                     <h3>User Accounts</h3>
                 </div>
                <div className="card-body table-container">
                    
                    {/* The table should only render when NOT loading */}
                    {!isLoading && ( 
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Staff Name</th>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Date Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#a0a5b1' }}>
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.userID}>
                                            <td>{user.staffName || 'N/A'}</td>
                                            <td>{user.username}</td>
                                            <td>
                                                <span className={`role-badge role-${user.role?.toLowerCase()}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${user.isActive ? 'enabled' : 'disabled'}`}>
                                                    {user.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>{formatDate(user.dateCreated)}</td>
                                            <td className="actions-cell">
                                                <button className="btn-edit" onClick={() => handleEditClick(user)}>
                                                    <FaEdit /> Edit
                                                </button>
                                                <button 
                                                    className="btn-delete" 
                                                    onClick={() => handleDelete(user)}
                                                >
                                                    <FaTimes /> Delete
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

export default UserManagement;