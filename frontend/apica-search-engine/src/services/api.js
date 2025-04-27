import { API_BASE_URL, API_ENDPOINTS, getHeaders } from './config';

/**
 * Search messages with pagination
 * @param {string} query - Search query
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Results per page
 * @returns {Promise<Object>} - Search results with pagination info
 */
export const searchMessages = async (query, page = 1, limit = 10) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.search}?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching messages:', error);
    throw error;
  }
};

/**
 * Generic error handler to be used with async/await
 * @param {Promise} promise - The promise to handle
 * @returns {Array} - [data, error]
 */
export const handleApiRequest = async (promise) => {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    console.error('API Error:', error);
    return [null, error];
  }
};