import React, { useState } from 'react';
import { FaUser, FaLock, FaUserTie, FaSpinner, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { apiCall } from './ApiService';
import './Register.css'; // We will create this file next

function Register({ setView }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [staffName, setStaffName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password || !staffName) {
            toast.error("Please fill in all fields.");
            return;
        }
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }

        setIsLoading(true);
        try {
            // This will call the 'api/Auth/register' endpoint
            await apiCall('Auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password, staffName }),
                headers: { 'Authorization': undefined } // No token needed for register
            });

            // The register endpoint automatically logs the user in
            // But our app logic in App.js doesn't know this yet.
            // For simplicity, we just tell them to log in.
            toast.success("Registration successful! Please log in.");
            setView('login'); // Send user back to login page

        } catch (error) {
            // apiCall already shows the error toast
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page-container">
            <form className="card login-form register-form" onSubmit={handleSubmit}>
                <div className="login-header">
                    <FaUserTie className="login-logo-icon" />
                    <h2>Create New Staff Account</h2>
                </div>
                
                <div className="form-group">
                    <label htmlFor="staffName"><FaUserTie /> Staff Name</label>
                    <input 
                        type="text"
                        id="staffName"
                        className="form-input"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="e.g., John Smith"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="username"><FaUser /> Username</label>
                    <input 
                        type="text"
                        id="username"
                        className="form-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Login ID (e.g., john)"
                        required
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="password"><FaLock /> Password</label>
                    <input 
                        type="password"
                        id="password"
                        className="form-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        required
                    />
                </div>
                
                <button type="submit" className="tab-button active" disabled={isLoading}>
                    {isLoading ? <FaSpinner className="spin" /> : 'Register New Account'}
                </button>
                
                <button type="button" className="btn-void back-to-login" onClick={() => setView('login')}>
                    <FaArrowLeft /> Back to Login
                </button>
            </form>
        </div>
    );
}

export default Register;