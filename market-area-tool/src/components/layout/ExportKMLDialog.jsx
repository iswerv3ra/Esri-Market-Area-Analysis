// src/components/market-areas/ExportKMLDialog.jsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';

export default function ExportKMLDialog({ isOpen, onClose, marketAreas, onExport }) {
  const [folderName, setFolderName] = useState('market_areas_export');
  const [selectedMAIds, setSelectedMAIds] = useState([]);

  useEffect(() => {
    // Initially select all
    setSelectedMAIds(marketAreas.map(ma => ma.id));
  }, [marketAreas]);

  const handleToggleMA = (maId) => {
    setSelectedMAIds((prev) =>
      prev.includes(maId) ? prev.filter((id) => id !== maId) : [...prev, maId]
    );
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedMAIds(marketAreas.map(ma => ma.id));
    } else {
      setSelectedMAIds([]);
    }
  };

  const handleExportClick = () => {
    onExport({ folderName, selectedMAIds });
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Transition.Child
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
          as={Fragment}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
            <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Export MAs as Shapefiles
            </Dialog.Title>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Market Areas
                </label>
                <div className="mb-2">
                  <input
                    type="checkbox"
                    checked={selectedMAIds.length === marketAreas.length && marketAreas.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-green-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Select All</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 border p-2 rounded-md dark:border-gray-600">
                  {marketAreas.map((ma) => (
                    <div key={ma.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedMAIds.includes(ma.id)}
                        onChange={() => handleToggleMA(ma.id)}
                        className="h-4 w-4 text-green-600 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {ma.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 
                  border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Cancel
              </button>
              <button
                onClick={handleExportClick}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Export
              </button>
            </div>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}
