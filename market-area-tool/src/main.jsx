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

// --- Removed labelApi specific setup ---
// The SimplifiedLabelManager uses localStorage directly and doesn't
// need the global window assignment or the API fallback logic
// that was previously here.
// If labelApi is used *elsewhere* in your app (unrelated to label positions),
// you might still need to import it, but the window assignment and dev block are removed.
// import { labelApi } from './services/label-api'; // Keep only if used elsewhere
// window.labelPositionsAPI = labelApi; // REMOVED
// if (import.meta.env.DEV) { ... } // REMOVED DEV BLOCK


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