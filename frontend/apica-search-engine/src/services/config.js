// services/config.js
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.example.com';

export const API_ENDPOINTS = {
  search: '/api/search',
};

export const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};