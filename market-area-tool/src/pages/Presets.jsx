import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

// Import the existing context instead of creating a new one
import { usePresets } from '../contexts/PresetsContext';
import { analysisCategories, getAllVariables } from '../services/enrichmentService';

const Modal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
          aria-label="Close Modal"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="p-6">
          <h2
            id="modal-title"
            className="text-2xl font-semibold text-gray-900 dark:text-white mb-4"
          >
            {title}
          </h2>
          <div className="max-h-96 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};

const VariablePresetModalContent = ({ preset, closeModal }) => {
  const {
    updateVariablePreset,
    makeVariablePresetGlobal,
    deleteVariablePreset,
  } = usePresets();
  const [isLoading, setIsLoading] = useState(false);

  const getVariableLabel = (variableId) => {
    for (const category of Object.values(analysisCategories)) {
      const variable = category.variables.find((v) => v.id === variableId);
      if (variable) {
        return variable.label;
      }
    }
    return variableId;
  };

  const handleRemoveVariable = async (varId) => {
    setIsLoading(true);
    try {
      const updatedVariables = preset.variables.filter((id) => id !== varId);
      await updateVariablePreset(preset.id, { variables: updatedVariables });
      toast.success('Variable removed');
    } catch (error) {
      console.error('Error removing variable:', error);
      toast.error('Failed to remove variable');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMakeGlobal = async () => {
    setIsLoading(true);
    try {
      await makeVariablePresetGlobal(preset.id);
      toast.success('Variable preset is now global');
      closeModal();
    } catch (error) {
      console.error('Error making preset global:', error);
      toast.error('Failed to make preset global');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePreset = async () => {
    if (window.confirm('Are you sure you want to delete this variable preset?')) {
      setIsLoading(true);
      try {
        await deleteVariablePreset(preset.id);
        toast.success('Variable preset deleted');
        closeModal();
      } catch (error) {
        console.error('Error deleting preset:', error);
        toast.error('Failed to delete preset');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p>
          <strong>Name:</strong> {preset.name}
          {preset.is_global && (
            <span className="ml-2 inline-flex items-center text-blue-600">
              <GlobeAltIcon className="h-4 w-4 mr-1" />
              Global
            </span>
          )}
        </p>
        {!preset.is_global && (
          <button
            onClick={handleMakeGlobal}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
          >
            <GlobeAltIcon className="h-4 w-4 mr-1" />
            Make Global
          </button>
        )}
      </div>

      <h4 className="mt-4 mb-2 font-medium">Variables:</h4>
      <ul className="list-disc list-inside max-h-60 overflow-y-auto space-y-2">
        {preset.variables.map((varId) => (
          <li key={varId} className="flex items-center justify-between">
            <span>{getVariableLabel(varId)}</span>
            <button
              onClick={() => handleRemoveVariable(varId)}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700 disabled:opacity-50"
              title="Remove Variable"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {!preset.is_global && (
        <button
          onClick={handleDeletePreset}
          disabled={isLoading}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Deleting...' : 'Delete Preset'}
        </button>
      )}
    </div>
  );
};

const VariablesPanel = ({
  selectedVariables,
  setSelectedVariables,
  searchTerm,
  setSearchTerm,
}) => {
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const toggleCategory = (categoryId) => {
    setExpandedCategories((prevExpanded) => {
      const newExpanded = new Set(prevExpanded);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return newExpanded;
    });
  };

  const toggleAllInCategory = (variables) => {
    setSelectedVariables((prevSelected) => {
      const newSelected = new Set(prevSelected);
      const allSelected = variables.every((v) => newSelected.has(v.id));

      variables.forEach((variable) => {
        if (allSelected) {
          newSelected.delete(variable.id);
        } else {
          newSelected.add(variable.id);
        }
      });

      return newSelected;
    });
  };

  const shouldShowCategory = (category) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return category.variables.some(
      (variable) =>
        variable.id.toLowerCase().includes(searchLower) ||
        variable.label.toLowerCase().includes(searchLower)
    );
  };

  const shouldShowVariable = (variable) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      variable.id.toLowerCase().includes(searchLower) ||
      variable.label.toLowerCase().includes(searchLower)
    );
  };

  const handleGlobalSelectAll = () => {
    const allVariableIds = getAllVariables();
    const allSelected = allVariableIds.every((id) => selectedVariables.has(id));
    if (allSelected) {
      setSelectedVariables(new Set());
      toast.success('All variables deselected');
    } else {
      setSelectedVariables(new Set(allVariableIds));
      toast.success('All variables selected');
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search variables..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 pl-10 
                     shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <button
            onClick={handleGlobalSelectAll}
            className="ml-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            {getAllVariables().every((id) => selectedVariables.has(id))
              ? 'Deselect All'
              : 'Select All'}
          </button>
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-auto p-4">
        {Object.entries(analysisCategories).map(([categoryId, category]) => {
          if (!shouldShowCategory(category)) return null;

          const isExpanded = expandedCategories.has(categoryId);
          const filteredVariables = category.variables.filter(shouldShowVariable);

          if (filteredVariables.length === 0) return null;

          return (
            <div key={categoryId} className="mb-4">
              {/* Category Header */}
              <div
                className="flex items-center gap-2 py-2 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 
                         rounded cursor-pointer"
                onClick={() => toggleCategory(categoryId)}
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
                <span className="font-medium">{category.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllInCategory(category.variables);
                  }}
                  className="ml-auto text-sm text-blue-600 hover:text-blue-700"
                >
                  {category.variables.every((v) => selectedVariables.has(v.id))
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>

              {/* Variables in Category */}
              {isExpanded && (
                <div className="ml-6 space-y-1">
                  {filteredVariables.map((variable) => (
                    <label
                      key={variable.id}
                      className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700 
                               rounded-md cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedVariables.has(variable.id)}
                        onChange={(e) => {
                          setSelectedVariables((prevSelected) => {
                            const newSelected = new Set(prevSelected);
                            if (e.target.checked) {
                              newSelected.add(variable.id);
                            } else {
                              newSelected.delete(variable.id);
                            }
                            return newSelected;
                          });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {variable.label}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {variable.id}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PresetsContent = () => {
  const {
    stylePresets,
    variablePresets,
    loading: isLoading,
    createVariablePreset: saveVariablePreset,
    deleteStylePreset,
    deleteVariablePreset,
  } = usePresets();

  const [selectedVariables, setSelectedVariables] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState(null);

  const handleSaveVariablePreset = async () => {
    try {
      if (!newPresetName.trim()) {
        toast.error("Please enter a preset name");
        return;
      }
  
      if (!selectedVariables || selectedVariables.size === 0) {
        toast.error("Please select at least one variable");
        return;
      }
  
      const presetData = {
        name: newPresetName.trim(),
        variables: Array.from(selectedVariables), // Convert Set to Array
        is_global: isGlobal
      };
  
      const response = await saveVariablePreset(presetData);
      
      if (response?.id) {
        toast.success("Variable preset created successfully!");
        // Reset form
        setNewPresetName("");
        setSelectedVariables(new Set());
        setIsGlobal(false);
      }
    } catch (error) {
      console.error("Error saving variable preset:", error);
      toast.error(error.response?.data?.message || "Error creating variable preset");
    }
  };


  const openPresetModal = (preset, type) => {
    setModalTitle(`${type === 'variable' ? 'Variable' : 'Preset'} Details`);
    if (type === 'variable') {
      setModalContent(
        <VariablePresetModalContent preset={preset} closeModal={closeModal} />
      );
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
    setModalTitle('');
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none bg-white dark:bg-gray-800 shadow">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Market Area Presets
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 lg:p-8">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Middle Panel - Analysis Variables */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Analysis Variables
              </h2>
            </div>
            <VariablesPanel
              selectedVariables={selectedVariables}
              setSelectedVariables={setSelectedVariables}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </div>

          {/* Right Panel - Saved Presets */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Saved Presets
              </h2>
              <div className="flex flex-col gap-4">
                {/* Preset Name and Global Checkbox */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Enter preset name"
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 
                             shadow-sm px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Save Variable Preset Button */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveVariablePreset}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                             flex items-center justify-center"
                    title="Save Variable Preset"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Save Variable
                  </button>
                </div>
              </div>
            </div>

            {/* Presets Lists */}
            <div className="flex-1 overflow-auto p-4">
              {/* Style Presets List */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Style Presets
                </h3>
                <div className="space-y-2">
                  {(stylePresets || []).map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 bg-gray-50 
                               dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {preset.name}
                        </span>
                        {preset.is_global && (
                          <GlobeAltIcon className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteStylePreset(preset.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete Preset"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(stylePresets || []).length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No style presets saved
                    </div>
                  )}
                </div>
              </div>

              {/* Variable Presets List */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Variable Presets
                </h3>
                <div className="space-y-2">
                  {(variablePresets || []).map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 bg-gray-50 
                               dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {preset.name}
                          </span>
                          {preset.is_global && (
                            <GlobeAltIcon className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {preset.variables.length} variables
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedVariables(new Set(preset.variables));
                            toast.success('Variable preset applied');
                          }}
                          className="text-blue-600 hover:text-blue-700"
                          title="Apply Preset"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openPresetModal(preset, 'variable')}
                          className="text-gray-600 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                          title="View Preset Details"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteVariablePreset(preset.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete Preset"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(variablePresets || []).length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No variable presets saved
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal for Preset Details */}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={modalTitle}>
              {modalContent}
            </Modal>
          </div>
        </div>
      </div>
    </div>
  );
};

const Presets = () => {
  return <PresetsContent />;
};

export default Presets;
