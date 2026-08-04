import React, { createContext, useContext, useEffect, useState } from 'react';
import { checkForUpdate, type VersionInfo } from '../services/updater';

interface UpdateContextValue {
  updateInfo: VersionInfo | null;
  clearUpdate: () => void;
}

const UpdateContext = createContext<UpdateContextValue>({
  updateInfo: null,
  clearUpdate: () => {},
});

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    checkForUpdate()
      .then(info => {
        if (info) setUpdateInfo(info);
      })
      .catch(() => {}); // silencioso, no molestar al usuario si falla
  }, []);

  return (
    <UpdateContext.Provider value={{ updateInfo, clearUpdate: () => setUpdateInfo(null) }}>
      {children}
    </UpdateContext.Provider>
  );
}

export const useUpdate = () => useContext(UpdateContext);
