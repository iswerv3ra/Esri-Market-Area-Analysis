import { createContext, useContext, useState, useEffect } from 'react';
import { stylePresetsAPI, variablePresetsAPI } from '../services/api';
import { toast } from 'react-hot-toast';

const PresetsContext = createContext(null);

export const usePresets = () => {
  const context = useContext(PresetsContext);
  if (!context) {
    throw new Error('usePresets must be used within PresetsProvider');
  }
  return context;
};

export const PresetsProvider = ({ children }) => {
  const [stylePresets, setStylePresets] = useState([]);
  const [variablePresets, setVariablePresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const value = {
    stylePresets,
    variablePresets,
    isLoading,
    // Add other methods as needed
  };

  return (
    <PresetsContext.Provider value={value}>
      {children}
    </PresetsContext.Provider>
  );
};

export default PresetsContext;