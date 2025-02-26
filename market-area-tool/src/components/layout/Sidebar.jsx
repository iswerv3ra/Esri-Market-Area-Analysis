import { useEffect, useState } from 'react';
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
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1a202c]">
      <div className="flex-none h-12 flex items-center justify-center px-5 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1e2330]">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {currentView === 'create'
            ? (editingMarketArea ? 'Edit Market Area' : 'Create Market Area')
            : 'Saved Market Areas'}
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1a202c]">
        {currentView === 'create' && (
          <MarketAreaForm 
            editingMarketArea={editingMarketArea}
            onComplete={handleFormComplete}
            onCancel={handleFormComplete}
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