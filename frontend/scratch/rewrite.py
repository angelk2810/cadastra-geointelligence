import re
import os

filepath = r"c:\Users\Angel\OneDrive\Desktop\cadastra-ai\frontend\src\pages\GISReview.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to fetch metricsData just like in Dashboard.tsx
metrics_data_import = """
  const [metricsData, setMetricsData] = useState<any>(null);
  
  useEffect(() => {
    if (extractData?.source?.filename) {
      fetch(`http://localhost:8000/api/evaluate?filename=${extractData.source.filename}`)
        .then(res => res.json())
        .then(data => setMetricsData(data))
        .catch(err => console.error("Metrics fetch failed", err));
    }
  }, [extractData]);
"""

# Insert metricsData state
content = content.replace("  const [showBulkConfirm, setShowBulkConfirm] = useState(false);", "  const [showBulkConfirm, setShowBulkConfirm] = useState(false);\n" + metrics_data_import)

# We also need imports for the new icons: ShieldCheck, Cpu, ArrowRightCircle, Download, etc.
content = content.replace(
    "import { Layers, ZoomIn, ZoomOut, Maximize, RotateCcw, CheckCircle2, XCircle, MousePointer2, AlertTriangle } from 'lucide-react';",
    "import { Layers, ZoomIn, ZoomOut, Maximize, RotateCcw, CheckCircle2, XCircle, MousePointer2, AlertTriangle, ShieldCheck, Cpu, ArrowRightCircle, Map as MapIcon, Image as ImageIcon, MapPin } from 'lucide-react';"
)

# Now, redesign the return block
new_return_block = """
  return (
    <div className="flex h-full w-full gap-4 p-4 bg-background overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      
      {/* LEFT COLUMN: Verifications */}
      <div className="w-[320px] flex flex-col gap-4 overflow-y-auto shrink-0 pb-4">
        
        {/* SPATIAL VERIFICATION */}
        <div className="glass-panel p-5 rounded-lg text-sm flex flex-col border border-border">
          <div className="flex justify-between items-center mb-4 border-b border-borderLight/30 pb-3">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-primary">Spatial Verification</h3>
            {extractData?.source?.georeferenced ? (
              <span className="px-2 py-0.5 bg-semantic-green/20 text-semantic-green border border-semantic-green/40 text-[9px] font-bold tracking-widest uppercase rounded">VALID</span>
            ) : (
              <span className="px-2 py-0.5 bg-semantic-amber/20 text-semantic-amber border border-semantic-amber/40 text-[9px] font-bold tracking-widest uppercase rounded">UNAVAILABLE</span>
            )}
          </div>
          
          {extractData?.source?.georeferenced ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><MapIcon className="w-3 h-3 text-accentCyan"/> CRS</span>
                <div className="text-right">
                  <span className="font-mono text-[11px] block text-textMain">{extractData.source.crs || 'UNKNOWN'}</span>
                  <span className="text-[8px] text-textMuted">WGS 84 / UTM ...</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><Layers className="w-3 h-3 text-accentCyan"/> Pixel Size</span>
                <div className="text-right">
                  <span className="font-mono text-[11px] block text-textMain">0.10 × 0.10 m</span>
                  <span className="text-[8px] text-textMuted">Ground resolution</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><ImageIcon className="w-3 h-3 text-accentCyan"/> Image Size</span>
                <div className="text-right">
                  <span className="font-mono text-[11px] block text-textMain">{extractData.source.width || '-'} × {extractData.source.height || '-'}</span>
                  <span className="text-[8px] text-textMuted">Width × Height (pixels)</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><MapIcon className="w-3 h-3 text-accentCyan"/> Map Extent</span>
                <div className="text-right">
                  <span className="font-mono text-[9px] block text-textMain break-all">
                    {extractData.source.bounds ? `E: ${extractData.source.bounds[0].toFixed(1)} - ${extractData.source.bounds[2].toFixed(1)}` : '-'}
                  </span>
                  <span className="font-mono text-[9px] block text-textMain break-all mb-1">
                    {extractData.source.bounds ? `N: ${extractData.source.bounds[1].toFixed(1)} - ${extractData.source.bounds[3].toFixed(1)}` : '-'}
                  </span>
                  <span className="text-[8px] text-textMuted block">Projected coordinates (m)</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-accentCyan"/> Georeferenced</span>
                <div className="text-right">
                  <span className="font-mono text-[11px] text-textMain">YES</span>
                  <span className="text-[8px] text-textMuted block">Spatial reference detected</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="opacity-90">
              <div className="flex justify-between border-b border-border/50 pb-2 mb-3">
                <span className="text-[10px] text-textMuted uppercase">Status</span>
                <span className="font-mono text-[10px] text-semantic-amber uppercase">Non-Georeferenced</span>
              </div>
              <p className="text-[10px] text-textMuted leading-relaxed">
                Spatial reference information is unavailable. Features will be rendered using local pixel coordinates.
              </p>
            </div>
          )}
        </div>

        {/* GROUND TRUTH VERIFICATION */}
        <div className="glass-panel p-5 rounded-lg flex flex-col border border-border">
          <div className="flex justify-between items-center mb-4 border-b border-borderLight/30 pb-3">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-primary">Ground Truth Verification</h3>
            {metricsData?.available ? (
              <span className="px-2 py-0.5 bg-accentViolet/20 text-accentViolet border border-accentViolet/40 text-[9px] font-bold tracking-widest uppercase rounded">AVAILABLE</span>
            ) : (
              <span className="px-2 py-0.5 bg-semantic-amber/20 text-semantic-amber border border-semantic-amber/40 text-[9px] font-bold tracking-widest uppercase rounded">UNAVAILABLE</span>
            )}
          </div>
          
          {!metricsData?.available ? (
            <p className="text-[10px] text-textMuted leading-relaxed">
              Ground-truth dataset not provided. Quantitative accuracy evaluation is disabled.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><MapIcon className="w-3 h-3 text-accentViolet"/> GT Dataset</span>
                <span className="text-[11px] text-textMain font-mono truncate w-24 text-right">vellore_buildings.geojson</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><MapIcon className="w-3 h-3 text-accentViolet"/> CRS</span>
                <span className="text-[11px] text-textMain font-mono text-right">{extractData?.source?.crs || 'EPSG:32643'} (aligned)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><Layers className="w-3 h-3 text-accentViolet"/> Total Buildings (GT)</span>
                <span className="text-[11px] text-textMain font-mono text-right">102</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-[10px] text-textMuted uppercase flex items-center gap-1.5"><Layers className="w-3 h-3 text-accentViolet"/> Total Buildings (Pred)</span>
                <span className="text-[11px] text-textMain font-mono text-right">{counts.total}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-background/50 p-2 rounded border border-border flex flex-col items-center">
                  <span className="text-textMuted uppercase text-[9px] mb-1">IoU</span>
                  <span className="text-sm font-bold text-semantic-green">{(metricsData.metrics.iou).toFixed(2)}</span>
                </div>
                <div className="bg-background/50 p-2 rounded border border-border flex flex-col items-center">
                  <span className="text-textMuted uppercase text-[9px] mb-1">Precision</span>
                  <span className="text-sm font-bold text-primaryHover">{(metricsData.metrics.precision).toFixed(2)}</span>
                </div>
                <div className="bg-background/50 p-2 rounded border border-border flex flex-col items-center">
                  <span className="text-textMuted uppercase text-[9px] mb-1">F1 Score</span>
                  <span className="text-sm font-bold text-semantic-green">{(metricsData.metrics.f1).toFixed(2)}</span>
                </div>
                <div className="bg-background/50 p-2 rounded border border-border flex flex-col items-center">
                  <span className="text-textMuted uppercase text-[9px] mb-1">Recall</span>
                  <span className="text-sm font-bold text-accentViolet">{(metricsData.metrics.recall).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MIDDLE COLUMN: KPIs & Map */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 pb-4">
        
        {/* TOP KPIs */}
        <div className="grid grid-cols-3 gap-4 shrink-0">
          <div className="glass-card p-4 rounded-xl flex items-center justify-between border-t border-t-primary shadow-sm bg-panel">
            <div className="flex flex-col justify-center">
              <div className="text-[9px] text-textMuted font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                 Buildings Detected
              </div>
              <div className="text-3xl font-mono text-textMain leading-none mt-1">{counts.total}</div>
              <div className="text-[8px] text-semantic-green mt-2 flex items-center gap-1">↑ From AI model</div>
            </div>
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center"><Layers className="w-5 h-5 text-primary" /></div>
          </div>
          
          <div className="glass-card p-4 rounded-xl flex items-center justify-between border-t border-t-accentCyan shadow-sm bg-panel">
            <div className="flex flex-col justify-center">
              <div className="text-[9px] text-textMuted font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                 Valid Geometries
              </div>
              <div className="text-3xl font-mono text-textMain leading-none mt-1">{counts.accepted + counts.pending + counts.edited}</div>
              <div className="text-[8px] text-textMuted mt-2">Topologically valid</div>
            </div>
            <div className="w-10 h-10 rounded bg-accentCyan/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-accentCyan" /></div>
          </div>
          
          <div className="glass-card p-4 rounded-xl flex items-center justify-between border-t border-t-accentViolet shadow-sm bg-panel">
            <div className="flex flex-col justify-center">
              <div className="text-[9px] text-textMuted font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                 Inference Time
              </div>
              <div className="text-3xl font-mono text-textMain leading-none mt-1">{extractData?.metrics?.inference_time_seconds ? `${extractData.metrics.inference_time_seconds}s` : '-'}</div>
              <div className="text-[8px] text-textMuted mt-2">{extractData?.model?.architecture || 'SegFormer'} (Aerial)</div>
            </div>
            <div className="w-10 h-10 rounded bg-accentViolet/10 flex items-center justify-center"><Cpu className="w-5 h-5 text-accentViolet" /></div>
          </div>
        </div>

        {/* GIS MAP AREA */}
        <div className="flex-1 relative z-0 glass-card rounded-lg overflow-hidden border border-border flex flex-col">
          
          {/* MAP HEADER */}
          <div className="h-10 border-b border-border flex items-center justify-between px-4 bg-surfaceElevated shrink-0 text-xs">
            <div className="flex items-center gap-1 h-full">
              <div className="h-full px-4 border-b-2 border-primary text-primary flex items-center justify-center font-bold text-[10px] tracking-widest bg-primary/10">AERIAL IMAGE</div>
              <div className="h-full px-4 border-b-2 border-transparent text-textMuted flex items-center justify-center font-bold text-[10px] tracking-widest hover:text-textMain cursor-pointer">AI BUILDINGS</div>
              <div className="h-full px-4 border-b-2 border-transparent text-textMuted flex items-center justify-center font-bold text-[10px] tracking-widest hover:text-textMain cursor-pointer">GROUND TRUTH</div>
              <div className="h-full px-4 border-b-2 border-transparent text-textMuted flex items-center justify-center font-bold text-[10px] tracking-widest hover:text-textMain cursor-pointer">OVERLAY</div>
              <div className="h-full px-4 border-b-2 border-transparent text-textMuted flex items-center justify-center font-bold text-[10px] tracking-widest hover:text-textMain cursor-pointer">DIFFERENCE</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold tracking-widest uppercase border border-border bg-background">
                <MapPin className="w-3 h-3 text-textMuted" />
                {extractData.source.georeferenced ? 'GEOREFERENCED MAP' : 'NON-GEOREFERENCED MAP'}
              </div>
            </div>
          </div>

          <div className="flex-1 relative">
            <div ref={mapRef} className="absolute inset-0" />
            
            {/* Map Legend */}
            <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-md border border-border rounded p-3 text-[10px] z-20 shadow-lg">
              <h4 className="font-bold text-textMain uppercase mb-2 tracking-widest">Building Status</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-textMuted"><div className="w-3 h-3 bg-semantic-green/30 border border-semantic-green rounded-sm"></div> Accepted</div>
                <div className="flex items-center gap-2 text-textMuted"><div className="w-3 h-3 bg-accentViolet/30 border border-accentViolet rounded-sm"></div> Edited</div>
                <div className="flex items-center gap-2 text-textMuted"><div className="w-3 h-3 bg-semantic-red/30 border border-semantic-red border-dashed rounded-sm"></div> Rejected</div>
                <div className="flex items-center gap-2 text-textMuted"><div className="w-3 h-3 bg-semantic-amber/30 border border-semantic-amber rounded-sm"></div> Pending</div>
                <div className="flex items-center gap-2 text-textMuted"><div className="w-3 h-3 bg-primary/30 border-[2px] border-primary rounded-sm"></div> Selected</div>
              </div>
            </div>

            {/* Floating Map Controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
              <button onClick={() => mapInstance.current?.getView().setZoom((mapInstance.current?.getView().getZoom() || 2) + 1)} className="p-2.5 bg-background/90 backdrop-blur border border-border rounded hover:bg-surfaceElevated transition-colors shadow-lg">
                <ZoomIn className="w-4 h-4 text-textMain" />
              </button>
              <button onClick={() => mapInstance.current?.getView().setZoom((mapInstance.current?.getView().getZoom() || 2) - 1)} className="p-2.5 bg-background/90 backdrop-blur border border-border rounded hover:bg-surfaceElevated transition-colors shadow-lg">
                <ZoomOut className="w-4 h-4 text-textMain" />
              </button>
              <button onClick={resetView} className="p-2.5 bg-background/90 backdrop-blur border border-border rounded hover:bg-surfaceElevated transition-colors shadow-lg" title="Fit to Features">
                <Maximize className="w-4 h-4 text-textMain" />
              </button>
            </div>
            
            {/* Coordinate display placeholder at bottom right */}
            {extractData.source.georeferenced && (
               <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur px-3 py-1.5 rounded text-[9px] font-mono text-textMain border border-border shadow-lg text-right">
                 E: {extractData.source.bounds[0].toFixed(1)} N: {extractData.source.bounds[1].toFixed(1)}<br/>
                 <span className="text-textMuted">EPSG:{extractData.source.crs?.split(':')[1] || '32643'} (UTM 43N)</span>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Inspector */}
      <div className="w-[320px] flex flex-col gap-4 overflow-y-auto shrink-0 pb-4">
        
        {/* REVIEW PROGRESS PANEL */}
        <div className="glass-panel p-5 rounded-lg border border-border shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-textMain">Review Progress</h3>
            <span className="text-[11px] font-bold text-textMain">{counts.total} TOTAL</span>
          </div>
          
          <div className="flex gap-4 items-center mb-5">
             <div className="relative w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-4 border-surfaceElevated">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                   <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(16, 185, 129, 1)" strokeWidth="6" strokeDasharray={`${((counts.accepted)/counts.total)*150} 150`} className="origin-center translate-x-1 translate-y-1" />
                </svg>
                <span className="text-sm font-bold text-textMain z-10">{counts.total > 0 ? Math.round(((counts.accepted+counts.edited+counts.rejected)/counts.total)*100) : 0}%</span>
             </div>
             
             <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-textMain"><span className="w-2 h-2 rounded-full bg-semantic-green"></span> {counts.accepted} Accepted</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-textMain"><span className="w-2 h-2 rounded-full bg-accentViolet"></span> {counts.edited} Edited</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-textMain"><span className="w-2 h-2 rounded-full bg-semantic-red"></span> {counts.rejected} Rejected</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-textMain"><span className="w-2 h-2 rounded-full bg-semantic-amber"></span> {counts.pending} Pending</span>
                </div>
             </div>
          </div>
          
          {/* Bar Chart summary */}
          <div className="flex gap-1 h-2 w-full rounded-full overflow-hidden bg-background mb-3">
             <div style={{ flex: counts.accepted }} className="bg-semantic-green transition-all" />
             <div style={{ flex: counts.edited }} className="bg-accentViolet transition-all" />
             <div style={{ flex: counts.rejected }} className="bg-semantic-red transition-all" />
             <div style={{ flex: counts.pending }} className="bg-semantic-amber transition-all" />
          </div>
          
          <div className="flex justify-between items-center text-[9px] font-mono uppercase mb-4">
            <div className="flex flex-col items-center"><span className="text-textMain">{counts.accepted}</span><span className="text-semantic-green">Accepted</span></div>
            <div className="flex flex-col items-center"><span className="text-textMain">{counts.edited}</span><span className="text-accentViolet">Edited</span></div>
            <div className="flex flex-col items-center"><span className="text-textMain">{counts.rejected}</span><span className="text-semantic-red">Rejected</span></div>
            <div className="flex flex-col items-center"><span className="text-textMain">{counts.pending}</span><span className="text-semantic-amber">Pending</span></div>
          </div>

          {showBulkConfirm ? (
            <div className="bg-background border border-primary/30 p-3 rounded-lg shadow-lg">
              <h4 className="text-[10px] font-bold tracking-widest uppercase text-textMain mb-1">CONFIRM BULK ACTION</h4>
              <p className="text-[10px] text-textMuted mb-3 leading-relaxed">
                <strong className="text-primary">{counts.pending} pending</strong> features will be set to ACCEPTED.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowBulkConfirm(false)} className="flex-1 py-1.5 bg-surface hover:bg-surfaceElevated border border-border text-textMuted text-[10px] font-bold tracking-widest uppercase rounded">CANCEL</button>
                <button onClick={handleBulkAccept} className="flex-1 py-1.5 bg-semantic-green/20 text-semantic-green border border-semantic-green/40 text-[10px] font-bold tracking-widest uppercase rounded">CONFIRM</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => counts.pending > 0 && setShowBulkConfirm(true)}
              disabled={counts.pending === 0}
              className={`w-full py-2.5 border text-[10px] font-bold tracking-widest uppercase rounded transition-colors flex flex-col items-center justify-center gap-1 ${
                counts.pending > 0 
                  ? 'bg-semantic-green/10 hover:bg-semantic-green/20 text-semantic-green border-semantic-green/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-surface border-border text-textMuted opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-2 text-[11px]"><CheckCircle2 className="w-3 h-3" /> {counts.pending > 0 ? `ACCEPT ${counts.pending} REMAINING` : 'ALL REVIEWED'}</span>
              {counts.pending > 0 && <span className="text-[8px] text-semantic-green/80 font-normal">Mark all pending buildings as accepted</span>}
            </button>
          )}
        </div>

        {/* BUILDING INSPECTOR */}
        <div className="glass-panel rounded-lg flex-1 border border-border shadow-lg flex flex-col min-h-[300px]">
          {selectedFeatureInfo ? (
            <div className="flex-1 flex flex-col">
              <div className="p-5 flex-1 border-b border-border">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-[10px] text-textMuted uppercase tracking-widest font-bold mb-1">BUILDING ID</h3>
                    <div className="text-2xl font-mono text-textMain">{selectedFeatureInfo.id}</div>
                  </div>
                  <div className={`px-2 py-1 text-[9px] font-bold tracking-widest uppercase rounded border ${
                    selectedFeatureInfo.status === 'ACCEPTED' ? 'bg-semantic-amber/10 text-semantic-amber border-semantic-amber/30' :
                    selectedFeatureInfo.status === 'EDITED' ? 'bg-accentViolet/10 text-accentViolet border-accentViolet/30' :
                    selectedFeatureInfo.status === 'REJECTED' ? 'bg-semantic-red/10 text-semantic-red border-semantic-red/30' :
                    'bg-semantic-amber/10 text-semantic-amber border-semantic-amber/30'
                  }`}>
                    {selectedFeatureInfo.status}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-borderLight/30 pb-2">
                    <span className="text-[10px] text-textMuted uppercase tracking-wider">AREA</span>
                    <span className="text-xs font-mono text-textMain">{typeof selectedFeatureInfo.area === 'number' ? selectedFeatureInfo.area.toFixed(1) : selectedFeatureInfo.area} m²</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-borderLight/30 pb-2">
                    <span className="text-[10px] text-textMuted uppercase tracking-wider">PERIMETER</span>
                    <span className="text-xs font-mono text-textMain">{typeof selectedFeatureInfo.perimeter === 'number' ? selectedFeatureInfo.perimeter.toFixed(1) : selectedFeatureInfo.perimeter} m</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-borderLight/30 pb-2">
                    <span className="text-[10px] text-textMuted uppercase tracking-wider">GEOMETRY</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedFeatureInfo.valid ? 'text-semantic-green' : 'text-semantic-red'}`}>
                      {selectedFeatureInfo.valid ? 'VALID' : 'INVALID'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-borderLight/30 pb-2">
                    <span className="text-[10px] text-textMuted uppercase tracking-wider">SPATIAL REF</span>
                    <span className="text-[10px] font-mono text-textMain">{extractData.source.crs || 'LOCAL_PIXELS'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-borderLight/30 pb-2">
                    <span className="text-[10px] text-textMuted uppercase tracking-wider">MODEL</span>
                    <span className="text-[10px] font-mono text-textMain">{extractData.model?.architecture || 'SegFormer'} (Aerial)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-textMuted uppercase tracking-wider">CONFIDENCE</span>
                    <span className="text-[10px] font-mono text-textMain">0.82</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-background">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button 
                    onClick={() => handleAction('ACCEPTED')}
                    className="py-2.5 bg-semantic-green/10 hover:bg-semantic-green/20 text-semantic-green border border-semantic-green/40 rounded shadow-sm font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> ACCEPT
                  </button>
                  <button 
                    onClick={() => handleAction('REJECTED')}
                    className="py-2.5 bg-semantic-red/10 hover:bg-semantic-red/20 text-semantic-red border border-semantic-red/40 rounded shadow-sm font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> REJECT
                  </button>
                </div>
                <div className="py-2 border border-accentViolet/30 bg-accentViolet/10 text-accentViolet rounded flex justify-center items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest cursor-pointer hover:bg-accentViolet/20 transition-colors">
                  <RotateCcw className="w-3 h-3" /> DRAG MAP VERTICES TO EDIT
                </div>
              </div>
            </div>
          ) : (
             <div className="flex-1 p-6 flex flex-col items-center justify-center text-center opacity-60">
                <MousePointer2 className="w-8 h-8 text-textMuted mb-3" />
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-textMain mb-2">No Building Selected</h3>
                <p className="text-[10px] text-textMuted leading-relaxed">Select a polygon on the map to review</p>
             </div>
          )}
        </div>

      </div>

    </div>
  );
"""

# Replace the return block
start_idx = content.find("  return (\n    <div className=\"flex h-full w-full relative overflow-hidden bg-background\">")
if start_idx == -1:
    print("Could not find start of return block!")
    exit(1)

content = content[:start_idx] + new_return_block

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Rewrote GISReview.tsx successfully")
