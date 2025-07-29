import React, { useEffect, useState } from 'react';
import MarketAreaForm from '../market-areas/MarketAreaForm';
import MarketAreaList from '../market-areas/MarketAreaList';

export default function Sidebar({ isOpen, onClose, sidebarContent, editingMarketArea, onEdit, onCreateNew, onCancel }) {
  // State to track if we're in create/edit mode or list mode
  const [currentView, setCurrentView] = useState('list');
  
  // Update view when sidebarContent changes
  useEffect(() => {
    if (sidebarContent === 'create') {
      setCurrentView('create');
    } else {
      setCurrentView('list');
    }
  }, [sidebarContent]);
  
  // Handle form submission or cancellation
  const handleFormComplete = () => {
    setCurrentView('list');
    if (onCancel) onCancel();
  };
  
  // When edit completes, return to list view
  const handleEditComplete = () => {
    onEdit?.(null);
    setCurrentView('list');
  };
  
  // Handle close button click
  const handleClose = () => {
    if (onClose) onClose();
  };
  
  return (
    <div 
      className={`
        h-full bg-white dark:bg-[#1a202c]
        shadow-lg
        absolute right-0 top-0 bottom-0
        transform transition-all duration-300 ease-in-out
        border-l border-gray-300 dark:border-gray-700
        border-t-0
        ${isOpen ? 'translate-x-0 w-[440px]' : 'translate-x-full w-[440px]'}
      `}
      style={{
        willChange: 'transform, width',
        overflowY: 'hidden',
        zIndex: 10 // Ensure sidebar is above other elements
      }}
    >
      {/* Header with close button - Now without top border */}
      <div className="flex-none h-11 flex items-center justify-between px-5 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1e2330] border-t-0">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {currentView === 'create'
            ? (editingMarketArea ? 'Edit Market Area' : 'Create Market Area')
            : 'Saved Market Areas'}
        </h2>
      </div>
      
      {/* Content area - Adjusted to account for shorter header */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a202c] h-[calc(100%-2.75rem)]">
        {currentView === 'create' && (
          <MarketAreaForm 
            editingMarketArea={editingMarketArea}
            onComplete={handleFormComplete}
            onCancel={handleFormComplete}
            onClose={handleClose}
          />
        )}
        {currentView === 'list' && (
          <MarketAreaList 
            onEdit={(area) => {
              onEdit?.(area);
              setCurrentView('create');
            }}
            onCreateNew={() => {
              if (onCreateNew) onCreateNew();
              setCurrentView('create');
            }}
          />
        )}
      </div>
    </div>
  );
}