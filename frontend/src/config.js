// Centralized API Base URL configuration
// 1. In local development: defaults to 'http://localhost:8000'
// 2. In Docker production / Nginx reverse proxy: if VITE_API_URL="" is passed, requests use relative path '/api'
// 3. Custom host: specify VITE_API_URL in .env (e.g. http://192.168.1.50:8000)
export const API_BASE = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : 'http://localhost:8000';
