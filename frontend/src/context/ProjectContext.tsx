import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type ProcessingStatus = 'READY' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

interface ProjectState {
  projectName: string;
  filename: string | null;
  status: ProcessingStatus;
  featuresCount: number;
  setProjectName: (name: string) => void;
  setFilename: (name: string | null) => void;
  setStatus: (status: ProcessingStatus) => void;
  setFeaturesCount: (count: number) => void;
}

const ProjectContext = createContext<ProjectState | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  // Initialize state directly from localStorage if available
  const [projectName, setProjectName] = useState(() => {
    const storedFile = localStorage.getItem('cadastra_current_file');
    return storedFile ? storedFile.split('.')[0] : 'New Project';
  });
  
  const [filename, setFilename] = useState<string | null>(() => {
    return localStorage.getItem('cadastra_current_file');
  });
  
  const [status, setStatus] = useState<ProcessingStatus>(() => {
    const storedFile = localStorage.getItem('cadastra_current_file');
    return storedFile ? 'COMPLETED' : 'READY';
  });
  
  const [featuresCount, setFeaturesCount] = useState(() => {
    const rawData = localStorage.getItem('cadastra_extraction_data');
    if (rawData) {
      try {
        const parsedData = JSON.parse(rawData);
        return parsedData.features ? parsedData.features.length : 0;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  });

  return (
    <ProjectContext.Provider value={{
      projectName,
      filename,
      status,
      featuresCount,
      setProjectName,
      setFilename,
      setStatus,
      setFeaturesCount
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
