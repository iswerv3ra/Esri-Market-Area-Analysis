import { Fragment } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import MarketAreaForm from '../market-areas/MarketAreaForm';
import MarketAreaList from '../market-areas/MarketAreaList';

export default function Sidebar({ isOpen, onClose, sidebarContent, editingMarketArea, onEdit }) {
  if (!isOpen) return null;
  
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 shadow-xl">
      <div className="flex-none h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {sidebarContent === 'create' 
            ? (editingMarketArea ? 'Edit Market Area' : 'Create Market Area')
            : 'Saved Market Areas'}
        </h2>
        <button
          type="button"
          className="rounded-md text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200 focus:outline-none"
          onClick={onClose}
        >
          <span className="sr-only">Close panel</span>
          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
        </button>
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