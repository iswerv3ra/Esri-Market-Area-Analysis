// src/pages/Presets.jsx

import React, { useState, useEffect, createContext, useContext } from 'react';
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

// Import APIs (Ensure these paths are correct)
import { stylePresetsAPI, variablePresetsAPI } from '../services/api';
import { analysisCategories, getAllVariables } from '../services/enrichmentService';

// 1. **Create Presets Context**
const PresetsContext = createContext(null);

// 2. **Context Hook**
const usePresets = () => {
  const context = useContext(PresetsContext);
  if (!context) {
    throw new Error('usePresets must be used within PresetsProvider');
  }
  return context;
};

// 3. **Market Area Types Definition**
const marketAreaTypes = [
  { value: 'radius', label: 'Radius' },
  { value: 'zip', label: 'Zip Code' },
  { value: 'county', label: 'County' },
  { value: 'place', label: 'Place' },
  { value: 'tract', label: 'Census Tract' },
  { value: 'block', label: 'Census Block' },
  { value: 'blockgroup', label: 'Census Block Group' },
  { value: 'cbsa', label: 'CBSA' },
  { value: 'state', label: 'State' },
  { value: 'usa', label: 'USA' },
];

// 4. **Default Style Configuration**
const DEFAULT_STYLE = {
  fillColor: '#0078D4',
  fillOpacity: 0.3,
  borderColor: '#0078D4',
  borderWidth: 2,
};

// 5. **PresetsProvider Component**
const PresetsProvider = ({ children }) => {
  const [stylePresets, setStylePresets] = useState([]);
  const [variablePresets, setVariablePresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch presets on mount
  useEffect(() => {
    const fetchPresets = async () => {
      setIsLoading(true);
      try {
        const [styleRes, variableRes] = await Promise.all([
          stylePresetsAPI.getAll(),
          variablePresetsAPI.getAll(),
        ]);
        setStylePresets(styleRes.data);
        setVariablePresets(variableRes.data);
      } catch (error) {
        console.error('Error fetching presets:', error);
        toast.error('Failed to load presets');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPresets();
  }, []);

  // Preset CRUD operations
  const saveStylePreset = async (name, styles, isGlobal = false) => {
    try {
      const response = await stylePresetsAPI.create({
        name,
        styles,
        is_global: isGlobal,
      });
      setStylePresets((prev) => [...prev, response.data]);
      toast.success('Style preset saved');
      return response.data;
    } catch (error) {
      console.error('Error saving style preset:', error);
      toast.error('Failed to save style preset');
      throw error;
    }
  };

  const saveVariablePreset = async (name, variables, isGlobal = false) => {
    try {
      const response = await variablePresetsAPI.create({
        name,
        variables,
        is_global: isGlobal,
      });
      setVariablePresets((prev) => [...prev, response.data]);
      toast.success('Variable preset saved');
      return response.data;
    } catch (error) {
      console.error('Error saving variable preset:', error);
      toast.error('Failed to save variable preset');
      throw error;
    }
  };

  const updateStylePreset = async (id, styles) => {
    try {
      const response = await stylePresetsAPI.update(id, { styles });
      setStylePresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, styles } : p))
      );
      toast.success('Style preset updated');
      return response.data;
    } catch (error) {
      console.error('Error updating style preset:', error);
      toast.error('Failed to update style preset');
      throw error;
    }
  };

  const updateVariablePreset = async (id, variables) => {
    try {
      const response = await variablePresetsAPI.update(id, { variables });
      setVariablePresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, variables } : p))
      );
      toast.success('Variable preset updated');
      return response.data;
    } catch (error) {
      console.error('Error updating variable preset:', error);
      toast.error('Failed to update variable preset');
      throw error;
    }
  };

  const deleteStylePreset = async (id) => {
    try {
      await stylePresetsAPI.delete(id);
      setStylePresets((prev) => prev.filter((p) => p.id !== id));
      toast.success('Style preset deleted');
    } catch (error) {
      console.error('Error deleting style preset:', error);
      toast.error('Failed to delete style preset');
      throw error;
    }
  };

  const deleteVariablePreset = async (id) => {
    try {
      await variablePresetsAPI.delete(id);
      setVariablePresets((prev) => prev.filter((p) => p.id !== id));
      toast.success('Variable preset deleted');
    } catch (error) {
      console.error('Error deleting variable preset:', error);
      toast.error('Failed to delete variable preset');
      throw error;
    }
  };

  const makeStylePresetGlobal = async (id) => {
    try {
      const response = await stylePresetsAPI.makeGlobal(id);
      setStylePresets((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, is_global: true } : p
        )
      );
      toast.success('Style preset is now global');
      return response.data;
    } catch (error) {
      console.error('Error making style preset global:', error);
      toast.error('Failed to make style preset global');
      throw error;
    }
  };

  const makeVariablePresetGlobal = async (id) => {
    try {
      const response = await variablePresetsAPI.makeGlobal(id);
      setVariablePresets((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, is_global: true } : p
        )
      );
      toast.success('Variable preset is now global');
      return response.data;
    } catch (error) {
      console.error('Error making variable preset global:', error);
      toast.error('Failed to make variable preset global');
      throw error;
    }
  };

  // Context value
  const value = {
    stylePresets,
    variablePresets,
    isLoading,
    saveStylePreset,
    saveVariablePreset,
    updateStylePreset,
    updateVariablePreset,
    deleteStylePreset,
    deleteVariablePreset,
    makeStylePresetGlobal,
    makeVariablePresetGlobal,
  };

  return (
    <PresetsContext.Provider value={value}>
      {children}
    </PresetsContext.Provider>
  );
};

// 6. **Modal Component**
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

// 7. **StylePresetModalContent Component**
const StylePresetModalContent = ({ preset, closeModal }) => {
  const { updateStylePreset, makeStylePresetGlobal } = usePresets();
  const [editableStyles, setEditableStyles] = useState(() =>
    JSON.parse(JSON.stringify(preset.styles))
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = (type, property, value) => {
    setEditableStyles((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [property]: value,
      },
    }));
  };

  const saveChanges = async () => {
    setIsLoading(true);
    try {
      await updateStylePreset(preset.id, editableStyles);
      toast.success('Style preset updated');
      closeModal();
    } catch (error) {
      console.error('Error updating preset:', error);
      toast.error('Failed to update preset');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMakeGlobal = async () => {
    setIsLoading(true);
    try {
      await makeStylePresetGlobal(preset.id);
      toast.success('Style preset is now global');
      closeModal();
    } catch (error) {
      console.error('Error making preset global:', error);
      toast.error('Failed to make preset global');
    } finally {
      setIsLoading(false);
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

      <h4 className="mt-4 mb-2 font-medium">Styles:</h4>
      <div className="space-y-4">
        {marketAreaTypes.map((typeItem) => (
          <div key={typeItem.value} className="mb-3">
            <p className="font-semibold">{typeItem.label}</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Fill Color */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Fill Color:
                </span>
                <input
                  type="color"
                  value={editableStyles[typeItem.value].fillColor}
                  onChange={(e) =>
                    handleEdit(typeItem.value, 'fillColor', e.target.value)
                  }
                  className="h-8 w-8 rounded cursor-pointer"
                />
                <span
                  className="h-8 w-8 rounded"
                  style={{
                    backgroundColor: editableStyles[typeItem.value].fillColor,
                  }}
                ></span>
              </div>

              {/* Fill Opacity */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Fill Opacity:
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editableStyles[typeItem.value].fillOpacity * 100}
                  onChange={(e) =>
                    handleEdit(
                      typeItem.value,
                      'fillOpacity',
                      Number(e.target.value) / 100
                    )
                  }
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400 w-12">
                  {Math.round(editableStyles[typeItem.value].fillOpacity * 100)}%
                </span>
              </div>

              {/* Border Color */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Border Color:
                </span>
                <input
                  type="color"
                  value={editableStyles[typeItem.value].borderColor}
                  onChange={(e) =>
                    handleEdit(
                      typeItem.value,
                      'borderColor',
                      e.target.value
                    )
                  }
                  className="h-8 w-8 rounded cursor-pointer"
                />
                <span
                  className="h-8 w-8 rounded"
                  style={{
                    backgroundColor:
                      editableStyles[typeItem.value].borderColor,
                  }}
                ></span>
              </div>

              {/* Border Width */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Border Width:
                </span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={editableStyles[typeItem.value].borderWidth}
                  onChange={(e) =>
                    handleEdit(
                      typeItem.value,
                      'borderWidth',
                      Number(e.target.value)
                    )
                  }
                  className="w-20 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  px
                </span>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Preview:
                </span>
                <div
                  className="h-8 w-16 rounded border-2 relative overflow-hidden"
                  style={{
                    backgroundColor: editableStyles[typeItem.value].fillColor,
                    opacity: editableStyles[typeItem.value].fillOpacity,
                    borderColor: editableStyles[typeItem.value].borderColor,
                    borderWidth: `${editableStyles[typeItem.value].borderWidth}px`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    Preview
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Changes Button */}
      <button
        onClick={saveChanges}
        disabled={isLoading}
        className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
};

// 8. **VariablePresetModalContent Component**
const VariablePresetModalContent = ({ preset, closeModal }) => {
  const { updateVariablePreset, makeVariablePresetGlobal } = usePresets();
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
      await updateVariablePreset(preset.id, updatedVariables);
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
    </div>
  );
};

// 9. **VariablesPanel Component**
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

// 10. **StyleEditor Component**
const StyleEditor = ({ currentStyle, setCurrentStyle }) => {
  const handleStyleChange = (type, property, value) => {
    setCurrentStyle((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [property]: value,
      },
    }));
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid gap-4">
        {marketAreaTypes.map((type) => (
          <div
            key={type.value}
            className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
          >
            <h3 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              {type.label}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Fill Color
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={currentStyle[type.value].fillColor}
                    onChange={(e) =>
                      handleStyleChange(
                        type.value,
                        'fillColor',
                        e.target.value
                      )
                    }
                    className="h-8 w-8 rounded cursor-pointer"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentStyle[type.value].fillOpacity * 100}
                    onChange={(e) =>
                      handleStyleChange(
                        type.value,
                        'fillOpacity',
                        Number(e.target.value) / 100
                      )
                    }
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-12">
                    {Math.round(currentStyle[type.value].fillOpacity * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300">
                  Border
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={currentStyle[type.value].borderColor}
                    onChange={(e) =>
                      handleStyleChange(
                        type.value,
                        'borderColor',
                        e.target.value
                      )
                    }
                    className="h-8 w-8 rounded cursor-pointer"
                  />
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={currentStyle[type.value].borderWidth}
                    onChange={(e) =>
                      handleStyleChange(
                        type.value,
                        'borderWidth',
                        Number(e.target.value)
                      )
                    }
                    className="w-20 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    px
                  </span>
                </div>
              </div>

              <div
                className="h-16 w-full rounded-lg border-2 relative overflow-hidden"
                style={{
                  backgroundColor: currentStyle[type.value].fillColor,
                  opacity: currentStyle[type.value].fillOpacity,
                  borderColor: currentStyle[type.value].borderColor,
                  borderWidth: `${currentStyle[type.value].borderWidth}px`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  Preview
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 11. **PresetsContent Component**
const PresetsContent = () => {
  const {
    stylePresets,
    variablePresets,
    isLoading,
    saveStylePreset,
    saveVariablePreset,
    deleteStylePreset,
    deleteVariablePreset,
  } = usePresets();

  const [currentStyle, setCurrentStyle] = useState(() => {
    return marketAreaTypes.reduce((acc, type) => {
      acc[type.value] = { ...DEFAULT_STYLE };
      return acc;
    }, {});
  });

  const [selectedVariables, setSelectedVariables] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState(null);

  const handleSaveStylePreset = async () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    try {
      await saveStylePreset(newPresetName.trim(), currentStyle, isGlobal);
      setNewPresetName('');
      setIsGlobal(false);
    } catch (error) {
      // Error is already handled in the context
    }
  };

  const handleSaveVariablePreset = async () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    if (selectedVariables.size === 0) {
      toast.error('Please select at least one variable');
      return;
    }

    try {
      await saveVariablePreset(
        newPresetName.trim(),
        Array.from(selectedVariables),
        isGlobal
      );
      setNewPresetName('');
      setIsGlobal(false);
    } catch (error) {
      // Error is already handled in the context
    }
  };

  const openPresetModal = (preset, type) => {
    setModalTitle(`${type === 'style' ? 'Style' : 'Variable'} Preset Details`);
    if (type === 'style') {
      setModalContent(
        <StylePresetModalContent preset={preset} closeModal={closeModal} />
      );
    } else if (type === 'variable') {
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
        <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Panel - Style Editor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Style Editor
              </h2>
            </div>
            <StyleEditor
              currentStyle={currentStyle}
              setCurrentStyle={setCurrentStyle}
            />
          </div>

          {/* Middle Panel - Variables Selector */}
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
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isGlobal}
                      onChange={(e) => setIsGlobal(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Global
                    </span>
                  </label>
                </div>

                {/* Save Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveStylePreset}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                             flex items-center justify-center"
                    title="Save Style Preset"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Save Style
                  </button>
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
                  {stylePresets.map((preset) => (
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
                          onClick={() => {
                            setCurrentStyle(preset.styles);
                            toast.success('Style preset applied');
                          }}
                          className="text-blue-600 hover:text-blue-700"
                          title="Apply Preset"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openPresetModal(preset, 'style')}
                          className="text-gray-600 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                          title="View Preset Details"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4" />
                        </button>
                        {!preset.is_global && (
                          <button
                            onClick={() => deleteStylePreset(preset.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete Preset"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {stylePresets.length === 0 && (
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
                  {variablePresets.map((preset) => (
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
                        {!preset.is_global && (
                          <button
                            onClick={() => deleteVariablePreset(preset.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete Preset"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {variablePresets.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No variable presets saved
                    </div>
                  )}
                </div>
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
  );
};

// 12. **Main Presets Component**
export default function Presets() {
  return (
    <PresetsProvider>
      <PresetsContent />
    </PresetsProvider>
  );
}
