import React, { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5212';

// We define apiCall logic locally for AuthContext's internal needs
const authApiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const url = `${API_URL}/api/${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: headers,
        });

        if (response.status === 401) {
            // Do not toast here to avoid spamming the user on app load
            throw new Error('Unauthorized'); 
        }

        // Handle success with no content (204)
        if (response.status === 204 || (options.method === 'DELETE' && response.ok)) {
            return { message: 'Operation successful (No Content)' };
        }
        
        const data = await response.json();

        if (!response.ok) {
            // Throw API error messages (like validation failures)
            throw new Error(data.message || `API error: ${response.status}`);
        }

        return data;
    } catch (error) {
        throw error; // Re-throw the error for local handling
    }
};


export const useAuth = () => {
    return useContext(AuthContext);
};

// --- NEW: Helper function to apply the theme class ---
const applyThemeToBody = (theme) => {
    if (theme === 'light') {
        document.body.classList.add('light');
        document.body.classList.remove('dark');
    } else {
        document.body.classList.add('dark');
        document.body.classList.remove('light');
    }
};

export const AuthProvider = ({ children }) => {
    // UPDATED: user now includes themePreference
    const [user, setUser] = useState(null); // {username, staffName, role, themePreference}
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        applyThemeToBody('dark'); // Default to dark on logout
        toast.info("Logged out successfully.");
    };
    
    // --- LOGIN FUNCTION (UPDATED) ---
    const login = async (username, password) => {
        setIsLoading(true);
        try {
            const data = await authApiCall('Auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
                headers: { 'Authorization': undefined }
            });

            localStorage.setItem('token', data.token);
            setToken(data.token);
            setUser(data.user); 
            applyThemeToBody(data.user.themePreference); // Apply theme on login
            toast.success(`Welcome, ${data.user.staffName}!`);
            return true;

        } catch (error) {
            toast.error(error.message || "Login failed. Check credentials.");
            setToken(null);
            setUser(null);
            applyThemeToBody('dark'); // Default to dark on fail
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // --- SET THEME FUNCTION (UPDATED) ---
    const setThemePreference = async (theme) => {
        if (!token || !user) return;
        
        // Optimistically update UI
        const oldTheme = user.themePreference;
        applyThemeToBody(theme);
        setUser(prevUser => ({
            ...prevUser,
            themePreference: theme
        }));

        try {
            // Send request to API to persist the change
            await authApiCall('Auth/theme', {
                method: 'PUT',
                body: JSON.stringify({ theme }),
            });
            
        } catch (error) {
            toast.error("Failed to save theme preference. Reverting.");
            console.error(error);
            // Revert UI on failure
            applyThemeToBody(oldTheme);
            setUser(prevUser => ({
                ...prevUser,
                themePreference: oldTheme
            }));
        }
    };

    // --- VALIDATE TOKEN FUNCTION (UPDATED) ---
    const validateToken = async () => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
            setIsCheckingAuth(false);
            applyThemeToBody('dark'); // Default to dark for logged out
            return;
        }
        
        try {
            const data = await authApiCall('Auth/me', { method: 'GET' });
            setUser(data); 
            setToken(storedToken);
            applyThemeToBody(data.themePreference); // Apply theme on load

        } catch (error) {
            logout(); // This will apply 'dark' theme
        } finally {
            setIsCheckingAuth(false);
        }
    };

    useEffect(() => {
        validateToken();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    const value = {
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        isCheckingAuth, 
        login,
        logout,
        setThemePreference, // <-- EXPOSE THE NEW FUNCTION
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};