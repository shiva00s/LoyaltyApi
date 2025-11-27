import { toast } from 'react-toastify';

//const API_URL = process.env.REACT_APP_API_URL || '';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5212';

/**
 * Executes a fetch request, automatically including the JWT token.
 * Handles 401 Unauthorized errors globally.
 * @param {string} endpoint - The API path (e.g., 'customer/123').
 * @param {object} options - Standard fetch options (method, body, etc.).
 * @returns {Promise<object>} - The JSON response data.
 */
export async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const url = `${API_URL}/api/${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else if (endpoint !== 'Auth/login' && endpoint !== 'Auth/register') {
        // Prevent calling secure endpoints if no token exists
        toast.error("Authentication token is missing. Please log in.");
        throw new Error('AuthenticationRequired');
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: headers,
        });

        // Handle 401 Unauthorized globally
        if (response.status === 401) {
            // Throw a specific error that the AuthContext knows how to handle
            throw new Error('Unauthorized');
        }

// --- NEW FIX: Handle successful responses with NO CONTENT (204) or DELETE (200/202) ---
        if (response.status === 204 || (options.method === 'DELETE' && response.ok)) {
            return { message: 'Operation successful (No Content)' };
        }
        // --- END NEW FIX ---
        
        const data = await response.json();

        if (!response.ok) {
            // Throw API error messages (like validation failures)
            throw new Error(data.message || `API error: ${response.status}`);
        }

        return data;
    } catch (error) {
        // Handle general network errors (e.g., API is offline)
        if (error.message === 'Failed to fetch') {
            toast.error('Could not connect to the Loyalty API.');
        } else if (error.message !== 'Unauthorized' && error.message !== 'AuthenticationRequired') {
            // Avoid double-toasting if it's a 401 error, as the system will trigger logout
            toast.error(error.message);
        }
        throw error; // Re-throw the error for local handling (e.g., setting loading=false)
    }
}