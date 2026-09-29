import { NavLink, Outlet } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { MapPin, LayoutDashboard, Map as MapIcon, ShieldAlert, Layers } from 'lucide-react';
import clsx from 'clsx';

export default function Layout() {
  const { projectName, filename, status, setFilename, setProjectName, setStatus } = useProject();

  const handleReset = () => {
    localStorage.removeItem('cadastra_current_features');
    localStorage.removeItem('cadastra_current_file');
    localStorage.removeItem('cadastra_extraction_data');
    localStorage.removeItem('cadastra_reviewed_data');
    setFilename(null);
    setProjectName('New Project');
    setStatus('READY');
    window.location.href = '/';
  };

  return (
    <div className="flex flex-col h-screen bg-background font-sans overflow-hidden text-textMain">
      
      {/* COMPACT TOP HEADER */}
      <header className="h-14 bg-surface/90 backdrop-blur border-b border-border flex items-center justify-between px-6 flex-shrink-0 z-50">
        
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-4 w-1/3">
          <div className="flex items-center gap-3 text-primary">
            <Layers className="w-8 h-8" />
            <div className="flex flex-col">
              <span className="font-bold tracking-widest uppercase text-xl leading-none">CADASTRAAI</span>
              <span className="text-[9px] text-textMuted uppercase tracking-widest mt-1">AI-ASSISTED URBAN MAPPING</span>
            </div>
          </div>
        </div>
        
        {/* Center: Primary Navigation */}
        <nav className="flex flex-1 justify-center items-end h-full">
          <NavLink
            to="/"
            className={({ isActive }) => clsx(
              "flex items-center gap-2 px-6 h-full border-t-2 transition-colors text-sm font-bold tracking-wider uppercase",
              isActive 
                ? "border-primary text-primary bg-primary/10" 
                : "border-transparent text-textMuted hover:text-textMain hover:bg-white/5"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>
          <NavLink
            to="/review"
            className={({ isActive }) => clsx(
              "flex items-center gap-2 px-6 h-full border-t-2 transition-colors text-sm font-bold tracking-wider uppercase",
              isActive 
                ? "border-primary text-primary bg-primary/10" 
                : "border-transparent text-textMuted hover:text-textMain hover:bg-white/5",
              status !== 'COMPLETED' && "opacity-50 pointer-events-none"
            )}
          >
            <MapIcon className="w-4 h-4" />
            GIS Review
          </NavLink>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-4 w-1/3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-border text-[10px] text-textMuted">
            <ShieldAlert className="w-3 h-3 text-textMuted" />
            <span className="hidden xl:inline">AI outputs require surveyor review</span>
          </div>
          {filename && status === 'COMPLETED' && (
            <button
              onClick={async () => {
                try {
                  const reviewed = localStorage.getItem('cadastra_reviewed_data');
                  const extractRaw = localStorage.getItem('cadastra_extraction_data');
                  if (!reviewed) return;
                  const parsedData = JSON.parse(reviewed);
                  const extractData = extractRaw ? JSON.parse(extractRaw) : null;
                  
                  const res = await fetch('http://localhost:8000/api/export_features', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        features: parsedData.features,
                        filename: filename,
                        crs: extractData?.source?.crs,
                        georeferenced: extractData?.source?.georeferenced || false
                    })
                  });
                  if (!res.ok) throw new Error("Export failed");
                  const data = await res.json();
                  const a = document.createElement('a');
                  a.href = `http://localhost:8000${data.download_url}`;
                  a.download = data.download_url.split('/').pop();
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } catch (e) {
                  console.error(e);
                  alert("Export Failed.");
                }
              }}
              className="px-5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold tracking-widest uppercase transition-colors"
            >
              Export
            </button>
          )}
          {filename && (
            <button 
              onClick={handleReset}
              className="px-5 py-1.5 bg-semantic-red/10 text-semantic-red border border-semantic-red/30 rounded text-[10px] font-bold tracking-wider hover:bg-semantic-red/20 uppercase transition-colors"
            >
              Reset Project
            </button>
          )}
        </div>
      </header>

      {/* SUB HEADER */}
      {filename && (
        <div className="h-10 bg-surface border-b border-border flex items-center px-6 gap-3 z-40 text-xs">
          <div className="flex items-center gap-2 text-textMuted">
            <span className="w-4 h-4 bg-semantic-green rounded-sm block"></span>
            <span>Project</span>
            <span className="text-borderLight mx-1">/</span>
            <span className="text-textMain">{projectName}</span>
            <span className="text-borderLight mx-1">/</span>
            <span className="text-textMain">{filename}</span>
          </div>
          
          <div className={clsx(
            "flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border ml-4",
            status === 'PROCESSING' && "bg-semantic-amber/10 text-semantic-amber border-semantic-amber/30",
            status === 'COMPLETED' && "bg-semantic-green/10 text-semantic-green border-semantic-green/30",
            status === 'ERROR' && "bg-semantic-red/10 text-semantic-red border-semantic-red/30",
            status === 'READY' && "bg-border/50 text-textMuted border-border"
          )}>
            {status}
          </div>

          {(() => {
            const raw = localStorage.getItem('cadastra_extraction_data');
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed?.source?.georeferenced) {
                  return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase border bg-semantic-green/10 text-semantic-green border-semantic-green/30">
                      <MapPin className="w-3 h-3" />
                      GEOREFERENCED
                    </div>
                  );
                }
              } catch (e) {}
            }
            return null;
          })()}
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 overflow-hidden bg-background relative flex flex-col p-4">
        <Outlet />
      </main>
    </div>
  );
}
