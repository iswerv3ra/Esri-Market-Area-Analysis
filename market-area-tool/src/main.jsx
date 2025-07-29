import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import axios from 'axios';

// Import MapProvider to wrap your application
// Ensure the path is correct based on your project structure
import { MapProvider } from './contexts/MapContext';

// Configure axios defaults (Still likely needed for other API calls like mapConfigurationsAPI)
axios.defaults.baseURL = import.meta.env.VITE_API_URL;

// Render the application
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* MapProvider remains essential for the rest of the map functionality */}
      <MapProvider>
        <App />
      </MapProvider>
    </BrowserRouter>
  </React.StrictMode>,
);