import React, { createContext, useContext, useState } from 'react';

interface SessionContextValue {
  sessionLoaded: boolean;   // exercises ready (pre-session or active)
  sessionActive: boolean;   // timer is running
  setSessionLoaded: (v: boolean) => void;
  setSessionActive: (v: boolean) => void;
}

const SessionContext = createContext<SessionContextValue>({
  sessionLoaded: false,
  sessionActive: false,
  setSessionLoaded: () => {},
  setSessionActive: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  return (
    <SessionContext.Provider value={{ sessionLoaded, sessionActive, setSessionLoaded, setSessionActive }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
