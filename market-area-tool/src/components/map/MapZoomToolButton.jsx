// src/components/map/MapZoomToolButton.jsx

import React from 'react';
import { Maximize } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * Button component for toggling the zoom tool in the map view
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isActive - Whether the zoom tool is active
 * @param {Function} props.onClick - Click handler function
 * @returns {JSX.Element} - Button component
 */
const MapZoomToolButton = ({ isActive, onClick }) => {
  return (
    <div
      className={`esri-widget--button esri-widget ${
        isActive ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-white text-black hover:bg-gray-100'
      } dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600`}
      role="button"
      tabIndex="0"
      title={isActive ? "Deactivate Zoom to Selection Tool" : "Activate Zoom to Selection Tool"}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{ 
        padding: '7px',
        cursor: 'pointer', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        borderRadius: '2px',
        position: 'relative',
      }}
    >
      <Maximize size={18} />
      {isActive && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      )}
    </div>
  );
};

MapZoomToolButton.propTypes = {
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default MapZoomToolButton;