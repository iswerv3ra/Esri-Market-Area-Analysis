// main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Add axios default config
import axios from 'axios'
axios.defaults.baseURL = import.meta.env.VITE_API_URL

// Import MapProvider to wrap your application
import { MapProvider } from './contexts/MapContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MapProvider>
        <App />
      </MapProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
