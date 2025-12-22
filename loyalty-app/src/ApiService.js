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
            toast.error('Session expired. Please log in again.');
            throw new Error('Unauthorized');
        }

        // Handle 403 Forbidden
        if (response.status === 403) {
            toast.error('Access denied. You do not have permission to perform this action.');
            throw new Error('Forbidden');
        }

        // Handle successful responses with NO CONTENT (204) or DELETE (200/202)
        if (response.status === 204 || (options.method === 'DELETE' && response.ok)) {
            return { message: 'Operation successful (No Content)' };
        }

        // FIXED: Check if response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            // Response is not JSON (might be HTML error page)
            const text = await response.text();
            console.error('Non-JSON response received:', text);
            
            if (!response.ok) {
                throw new Error(`API error (${response.status}): Server returned non-JSON response`);
            }
            
            // If it's a successful response but not JSON, return empty object
            return { message: 'Operation successful' };
        }

        // Parse JSON response
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error('Failed to parse JSON response:', jsonError);
            if (!response.ok) {
                throw new Error(`API error (${response.status}): Invalid JSON response`);
            }
            return { message: 'Operation successful' };
        }

        if (!response.ok) {
            // Throw API error messages (like validation failures)
            throw new Error(data.message || data.title || `API error: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Call Error:', error);
        
        // Handle general network errors (e.g., API is offline)
        if (error.message === 'Failed to fetch') {
            toast.error('Could not connect to the Loyalty API. Please check if the server is running.');
        } else if (error.message === 'Unauthorized') {
            // This will be handled by AuthContext
            // Don't show toast here as it will trigger logout
        } else if (error.message === 'AuthenticationRequired') {
            // Already showed toast above
        } else if (error.message === 'Forbidden') {
            // Already showed toast above
        } else {
            // Show generic error toast for other errors
            toast.error(error.message || 'An unexpected error occurred');
        }
        
        throw error; // Re-throw the error for local handling
    }
}
