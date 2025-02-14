import { Fragment, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import MarketAreaForm from '../market-areas/MarketAreaForm';
import MarketAreaList from '../market-areas/MarketAreaList';

export default function Sidebar({ isOpen, onClose, sidebarContent, editingMarketArea, onEdit }) {
  if (!isOpen) return null;

  useEffect(() => {
    if (!isOpen) {
      onEdit?.(null);
    }
  }, [isOpen, onEdit]);
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <div className="flex-none h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {sidebarContent === 'create' 
            ? (editingMarketArea ? 'Edit Market Area' : 'Create Market Area')
            : 'Saved Market Areas'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sidebarContent === 'create' && (
          <MarketAreaForm onClose={onClose} editingMarketArea={editingMarketArea} />
        )}
        {sidebarContent === 'list' && (
          <MarketAreaList onClose={onClose} onEdit={onEdit} />
        )}
      </div>
    </div>
  );
}