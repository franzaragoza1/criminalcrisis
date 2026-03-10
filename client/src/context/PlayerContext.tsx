import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Release } from '../types';

interface PlayerContextType {
  currentRelease: Release | null;
  playRelease: (release: Release) => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType>({
  currentRelease: null,
  playRelease: () => {},
  closePlayer: () => {},
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentRelease, setCurrentRelease] = useState<Release | null>(null);

  return (
    <PlayerContext.Provider value={{
      currentRelease,
      playRelease: setCurrentRelease,
      closePlayer: () => setCurrentRelease(null),
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
