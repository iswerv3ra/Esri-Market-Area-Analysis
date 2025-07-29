// src/components/map/MapZoomToolButton.jsx
import React from 'react';
import { Search, ZoomIn } from 'lucide-react';
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
  const handleKeyDown = (e) => {
    // Handle keyboard accessibility for Enter and Space keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const handleClick = (e) => {
    // Prevent any potential event bubbling
    e.stopPropagation();
    onClick();
  };

  return (
    <div
      className={`esri-widget--button esri-widget transition-all duration-200 ease-in-out ${
        isActive 
          ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md' 
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
      } dark:${
        isActive 
          ? 'bg-blue-600 hover:bg-blue-700' 
          : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'
      }`}
      role="button"
      tabIndex="0"
      title={isActive ? "Deactivate Zoom to Selection Tool" : "Activate Zoom to Selection Tool"}
      aria-label={isActive ? "Deactivate Zoom to Selection Tool" : "Activate Zoom to Selection Tool"}
      aria-pressed={isActive}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{ 
        padding: '8px',
        cursor: 'pointer', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        boxShadow: isActive 
          ? '0 2px 4px rgba(59, 130, 246, 0.3)' 
          : '0 1px 2px rgba(0,0,0,0.1)',
        borderRadius: '3px',
        position: 'relative',
        minWidth: '34px',
        minHeight: '34px',
        userSelect: 'none',
      }}
    >
      {/* Main icon - uses ZoomIn for better semantic meaning */}
      <ZoomIn 
        size={16} 
        strokeWidth={isActive ? 2.5 : 2}
        className={`transition-transform duration-150 ${
          isActive ? 'scale-110' : 'scale-100'
        }`}
      />
      
      {/* Active indicator - positioned overlay */}
      {isActive && (
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border border-white shadow-sm"
          aria-hidden="true"
          style={{
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.8)',
          }}
        />
      )}
      
      {/* Focus indicator for accessibility */}
      <div 
        className={`absolute inset-0 rounded-sm transition-opacity duration-150 ${
          isActive ? 'opacity-0' : 'opacity-0'
        } focus-within:opacity-100`}
        style={{
          outline: '2px solid #3b82f6',
          outlineOffset: '2px',
        }}
      />
    </div>
  );
};

MapZoomToolButton.propTypes = {
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

MapZoomToolButton.defaultProps = {
  isActive: false,
};

export default MapZoomToolButton;