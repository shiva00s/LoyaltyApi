import React, { useState } from 'react';
//import React, { useState, useEffect } from 'react';
import { FaLock, FaUser, FaAward, FaSpinner } from 'react-icons/fa';
import { useAuth } from './AuthContext'; // <-- IMPORT AUTH HOOK
import { toast } from 'react-toastify';

function Login({ onSwitchToRegister }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const { login, isLoading } = useAuth(); // Get login function and loading state

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            toast.error("Please enter username and password.");
            return;
        }
        await login(username, password);
    };

    return (
        <div className="login-page-container">
            <form className="card login-form" onSubmit={handleSubmit}>
                <div className="login-header">
                    <FaAward className="login-logo-icon" />
                    <h2>Loyalty System Login</h2>
                </div>
                
                <div className="form-group">
                    <label htmlFor="username"><FaUser /> Username</label>
                    <input 
                        type="text"
                        id="username"
                        className="form-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Staff ID"
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
                        placeholder="Password"
                        required
                    />
                </div>
                
                <button type="submit" className="tab-button active" disabled={isLoading}>
                    {isLoading ? <FaSpinner className="spin" /> : 'Log In'}
                </button>
                
                <p className="register-text">
    New staff?{' '}
    <button 
        type="button" 
        className="link-button" 
        onClick={onSwitchToRegister}
    >
        Create a new account
    </button>
</p>
            </form>
        </div>
    );
}

export default Login;