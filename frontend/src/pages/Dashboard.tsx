import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Image as ImageIcon, Map as MapIcon, ArrowRight, Layers, ShieldCheck, Cpu, Download, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Stroke, Fill } from 'ol/style';

export default function Dashboard() {
  const { filename, status, setFilename, setStatus, setProjectName } = useProject();
  const navigate = useNavigate();

  // Upload State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data State
  const [extractData, setExtractData] = useState<any>(null);
  const [reviewStats, setReviewStats] = useState({
    total: 0, accepted: 0, edited: 0, rejected: 0, pending: 0, valid: 0, invalid: 0
  });
  const [metricsData, setMetricsData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Map State
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);

  // Load State
  useEffect(() => {
    if (status === 'COMPLETED') {
      const rawExtraction = localStorage.getItem('cadastra_extraction_data');
      if (rawExtraction) {
        const parsed = JSON.parse(rawExtraction);
        setExtractData(parsed);

        const rawReview = localStorage.getItem('cadastra_reviewed_data');
        let total = parsed.features?.length || 0;
        let valid = total;
        let invalid = 0;
        let accepted = 0, edited = 0, rejected = 0, pending = total;

        if (rawReview) {
          const parsedReview = JSON.parse(rawReview);
          const features = parsedReview.features || [];
          accepted = features.filter((f: any) => f.properties?.review_status === 'ACCEPTED').length;
          edited = features.filter((f: any) => f.properties?.review_status === 'EDITED').length;
          rejected = features.filter((f: any) => f.properties?.review_status === 'REJECTED').length;
          pending = features.filter((f: any) => f.properties?.review_status === 'PENDING' || !f.properties?.review_status).length;
          invalid = features.filter((f: any) => f.properties?.geometry_valid === false).length;
          valid = total - invalid;
        }
        setReviewStats({ total, accepted, edited, rejected, pending, valid, invalid });
      }

      fetch('http://localhost:8000/api/metrics')
        .then(res => res.json())
        .then(data => setMetricsData(data))
        .catch(err => console.error(err));
    }
  }, [status]);

  // Init Map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || !extractData) return;

    const sourceMeta = extractData.source;
    const isGeoreferenced = sourceMeta?.georeferenced;
    const extent = sourceMeta?.bounds || [0, 0, 1000, 1000];
    
    let proj: any = undefined;
    if (!isGeoreferenced) {
      import('ol/proj/Projection').then(({ default: Projection }) => {
        proj = new Projection({ code: 'local-image', units: 'pixels', extent: extent });
        setupMap(proj, extent, sourceMeta, isGeoreferenced);
      });
    } else {
      setupMap(undefined, extent, sourceMeta, isGeoreferenced);
    }

    function setupMap(proj: any, extent: number[], sourceMeta: any, isGeoref: boolean) {
      const layers: any[] = [];
      
      layers.push(new ImageLayer({
          source: new Static({
              url: `http://localhost:8000/api/image/${sourceMeta.filename}`,
              projection: proj,
              imageExtent: extent,
          }),
          zIndex: 0
      }));
      
      const vectorSource = new VectorSource();
      layers.push(new VectorLayer({
          source: vectorSource,
          style: new Style({
              stroke: new Stroke({ color: '#0ea5e9', width: 1.5 }),
              fill: new Fill({ color: 'rgba(14, 165, 233, 0.15)' }),
          }),
          zIndex: 1
      }));
      
      const map = new Map({
        target: mapRef.current!,
        layers,
        view: new View({
            projection: proj,
            center: [(extent[0] + extent[2])/2, (extent[1] + extent[3])/2],
            zoom: 2
        }),
        controls: [] // Hide default controls for preview
      });

      if (extractData.features && extractData.features.length > 0) {
        const olFeatures = new GeoJSON().readFeatures({ type: 'FeatureCollection', features: extractData.features });
        if (!isGeoref) {
            olFeatures.forEach(f => {
                const geom = f.getGeometry();
                if (geom) { geom.scale(1, -1, [0, 0]); geom.translate(0, extent[3]); }
            });
        }
        vectorSource.addFeatures(olFeatures);
      }
      
      map.getView().fit(extent, { padding: [50, 50, 50, 50] });
      mapInstance.current = map;
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, [extractData]);

  // Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setFilename(file.name);
    setProjectName(file.name.split('.')[0]);
    setStatus('READY');
  };

  const handleRunExtraction = async () => {
    if (!selectedFile) return;
    setStatus('PROCESSING');
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const uploadRes = await fetch('http://localhost:8000/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      
      const extractRes = await fetch('http://localhost:8000/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: uploadData.filename })
      });
      
      if (extractRes.status === 503) {
        alert((await extractRes.json()).message);
        setStatus('ERROR');
        return;
      }
      
      const extractData = await extractRes.json();
      localStorage.setItem('cadastra_current_features', JSON.stringify({ type: "FeatureCollection", features: extractData.features || [] }));
      localStorage.setItem('cadastra_current_file', uploadData.filename);
      localStorage.setItem('cadastra_extraction_data', JSON.stringify(extractData));
      
      setStatus('COMPLETED');
    } catch (err) {
      console.error(err);
      setStatus('ERROR');
    }
  };

  const handleExport = async () => {
    if (!filename) return;
    setIsExporting(true);
    try {
      const reviewed = localStorage.getItem('cadastra_reviewed_data');
      if (!reviewed) return;
      const parsedData = JSON.parse(reviewed);
      
      const res = await fetch('http://localhost:8000/api/export_features', {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
             features: parsedData.features,
             filename: filename,
             crs: extractData?.source?.crs,
             georeferenced: extractData?.source?.georeferenced || false
         })
      });
      
      if (!res.ok) throw new Error("Export failed.");
      
      const responseData = await res.json();
      const a = document.createElement('a');
      a.href = `http://localhost:8000${responseData.download_url}`;
      a.download = responseData.download_url.split('/').pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const isGeoTiff = (selectedFile?.name || filename || '').toLowerCase().endsWith('.tif') || (selectedFile?.name || filename || '').toLowerCase().endsWith('.tiff');

  // RENDER UPLOAD HERO IF NO FILE OR NOT COMPLETED
  if (status !== 'COMPLETED' || !extractData) {
    return (
      <div className="flex flex-col h-full overflow-y-auto px-6 py-8 md:px-12 md:py-8 bg-background relative z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] -z-10 pointer-events-none" />
        
        <div className="w-full mx-auto flex flex-col gap-10" style={{ maxWidth: 'min(94vw, 1500px)' }}>
          
          {/* HERO SECTION */}
          <div className="grid gap-8 items-center" style={{ gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)' }}>
            {/* Left: Copy & Upload */}
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-textMain mb-4 uppercase">CadastraAI</h1>
                <h2 className="text-xl md:text-2xl font-light text-primary tracking-wide mb-6 uppercase">AI-Assisted Urban Mapping</h2>
                <p className="text-textMuted text-sm md:text-base leading-relaxed max-w-lg mb-8">
                  Transform aerial imagery into review-ready building intelligence using AI segmentation and professional GIS workflows.
                </p>
              </div>

              {status === 'PROCESSING' ? (
                 <div className="glass-card p-10 rounded-xl flex flex-col items-center justify-center border-primary/30 w-full h-[200px] shadow-[0_0_40px_rgba(14,165,233,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-primary"><Cpu className="w-6 h-6 animate-pulse" /></div>
                    </div>
                    <h2 className="text-lg font-bold tracking-widest text-textMain uppercase">Extracting Intelligence</h2>
                    <p className="text-primary font-mono text-xs mt-2 uppercase tracking-widest">{filename}</p>
                 </div>
              ) : (
                <div className="flex flex-col gap-4 w-full">
                  <div 
                    className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all bg-surfaceElevated/40 backdrop-blur cursor-pointer w-full h-[200px] ${dragActive ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(14,165,233,0.2)]' : 'border-borderLight hover:border-primary/50 hover:bg-surfaceElevated/60'}`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.tif,.tiff" onChange={handleChange} className="hidden" />
                    <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${dragActive ? 'text-primary' : 'text-textMuted'}`} />
                    <p className="text-sm font-bold tracking-widest text-textMain mb-2 uppercase">Upload Aerial Imagery</p>
                    <p className="text-[11px] text-textMuted font-mono uppercase tracking-widest">PNG / JPG / GeoTIFF supported</p>
                  </div>

                  {selectedFile && (
                    <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-primary/20 bg-primary/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded flex items-center justify-center text-primary border border-primary/30">
                          {isGeoTiff ? <MapIcon className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-textMain uppercase tracking-wider">{selectedFile.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-textMuted font-mono">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                            {!isGeoTiff && <span className="text-[9px] bg-semantic-amber/10 text-semantic-amber border border-semantic-amber/20 px-1.5 rounded uppercase tracking-widest font-bold">No CRS</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={handleRunExtraction} className="px-5 py-2.5 bg-primary hover:bg-primaryHover text-white font-bold tracking-widest text-[10px] uppercase rounded shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all">
                        Run Extraction
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Abstract Geospatial Visual */}
            <div className="hidden lg:flex items-center justify-center relative h-[400px]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.1)_0%,transparent_70%)]" />
              <div className="relative w-[400px] h-[300px] border border-primary/20 rounded-xl overflow-hidden bg-surface/50 backdrop-blur flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <div className="absolute w-64 h-64 border border-primary/30 rounded-full animate-[spin_60s_linear_infinite]" />
                <div className="absolute w-48 h-48 border border-accentCyan/30 rounded-full border-dashed animate-[spin_40s_linear_infinite_reverse]" />
                
                <div className="absolute top-1/4 left-1/4 w-12 h-16 border-2 border-primary bg-primary/20 transform rotate-12 shadow-[0_0_15px_rgba(14,165,233,0.5)]"></div>
                <div className="absolute bottom-1/3 right-1/4 w-20 h-14 border-2 border-accentViolet bg-accentViolet/20 transform -rotate-6 shadow-[0_0_15px_rgba(139,92,246,0.5)]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-textMuted/30"></div>
                
                <div className="absolute top-4 left-4 flex gap-1"><div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div><div className="text-[8px] font-mono text-primary uppercase">Satellite Uplink</div></div>
                <div className="absolute bottom-4 right-4 text-[8px] font-mono text-textMuted text-right">LAT 40.7128<br/>LNG -74.0060</div>
              </div>
            </div>
          </div>

          {/* WORKFLOW STRIP */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-8 border-y border-border/50 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-border -z-10 hidden md:block"></div>
            
            <div className="flex flex-col items-center bg-background px-4 gap-2">
              <div className="w-8 h-8 rounded-full bg-surfaceElevated border border-primary/50 text-primary flex items-center justify-center font-mono text-xs font-bold shadow-[0_0_10px_rgba(14,165,233,0.2)]">01</div>
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-textMain">Upload</h3>
              <p className="text-[9px] text-textMuted uppercase tracking-wider">Aerial Imagery</p>
            </div>
            <ArrowRight className="w-4 h-4 text-borderLight hidden md:block bg-background" />
            
            <div className="flex flex-col items-center bg-background px-4 gap-2">
              <div className="w-8 h-8 rounded-full bg-surfaceElevated border border-accentCyan/50 text-accentCyan flex items-center justify-center font-mono text-xs font-bold">02</div>
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-textMain">AI Extraction</h3>
              <p className="text-[9px] text-textMuted uppercase tracking-wider">Building Footprints</p>
            </div>
            <ArrowRight className="w-4 h-4 text-borderLight hidden md:block bg-background" />
            
            <div className="flex flex-col items-center bg-background px-4 gap-2">
              <div className="w-8 h-8 rounded-full bg-surfaceElevated border border-accentViolet/50 text-accentViolet flex items-center justify-center font-mono text-xs font-bold">03</div>
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-textMain">GIS Review</h3>
              <p className="text-[9px] text-textMuted uppercase tracking-wider">Surveyor Validation</p>
            </div>
            <ArrowRight className="w-4 h-4 text-borderLight hidden md:block bg-background" />

            <div className="flex flex-col items-center bg-background px-4 gap-2">
              <div className="w-8 h-8 rounded-full bg-surfaceElevated border border-semantic-green/50 text-semantic-green flex items-center justify-center font-mono text-xs font-bold">04</div>
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-textMain">Export</h3>
              <p className="text-[9px] text-textMuted uppercase tracking-wider">GIS-ready GeoJSON</p>
            </div>
          </div>

          {/* CAPABILITY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-xl border-t-2 border-t-primary">
              <Cpu className="w-5 h-5 text-primary mb-3" />
              <h4 className="text-[11px] font-bold tracking-widest uppercase text-textMain mb-2">AI Extraction</h4>
              <p className="text-xs text-textMuted leading-relaxed">Detect high-fidelity building footprints directly from raw aerial imagery.</p>
            </div>
            <div className="glass-card p-5 rounded-xl border-t-2 border-t-accentViolet">
              <MapIcon className="w-5 h-5 text-accentViolet mb-3" />
              <h4 className="text-[11px] font-bold tracking-widest uppercase text-textMain mb-2">GIS Review</h4>
              <p className="text-xs text-textMuted leading-relaxed">Inspect, accept, reject and edit AI-generated geometries in a professional map interface.</p>
            </div>
            <div className="glass-card p-5 rounded-xl border-t-2 border-t-accentCyan">
              <ShieldCheck className="w-5 h-5 text-accentCyan mb-3" />
              <h4 className="text-[11px] font-bold tracking-widest uppercase text-textMain mb-2">GT Evaluation</h4>
              <p className="text-xs text-textMuted leading-relaxed">Compare extraction performance against ground-truth reference data when available.</p>
            </div>
            <div className="glass-card p-5 rounded-xl border-t-2 border-t-semantic-green">
              <Download className="w-5 h-5 text-semantic-green mb-3" />
              <h4 className="text-[11px] font-bold tracking-widest uppercase text-textMain mb-2">GIS Export</h4>
              <p className="text-xs text-textMuted leading-relaxed">Export fully reviewed feature sets as GIS-compatible GeoJSON datasets.</p>
            </div>
          </div>

          {/* DISCLAIMER */}
          <div className="text-center mt-auto pt-8">
            <p className="text-[10px] text-textMuted/60 uppercase tracking-widest">
              AI-generated features are preliminary mapping outputs intended for GIS and surveyor review.<br/>
              They do not constitute legally authoritative cadastral boundaries or ownership determinations.
            </p>
          </div>

        </div>
      </div>
    );
  }

  // RENDER MASTER DASHBOARD
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background relative space-y-6">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      
      {/* SECTION B: KEY METRICS STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded flex flex-col justify-between border-t-2 border-t-primary">
          <div className="text-[10px] text-textMuted font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
            <Layers className="w-3 h-3 text-primary" /> Buildings Detected
          </div>
          <div className="text-3xl font-mono text-textMain leading-none mt-2">{reviewStats.total}</div>
        </div>
        <div className="glass-card p-4 rounded flex flex-col justify-between border-t-2 border-t-semantic-green">
          <div className="text-[10px] text-textMuted font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-semantic-green" /> Valid Geometries
          </div>
          <div className="text-3xl font-mono text-textMain leading-none mt-2">{reviewStats.valid}</div>
        </div>
        <div className="glass-card p-4 rounded flex flex-col justify-between border-t-2 border-t-accentCyan">
          <div className="text-[10px] text-textMuted font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
            <Cpu className="w-3 h-3 text-accentCyan" /> Inference Time
          </div>
          <div className="text-3xl font-mono text-textMain leading-none mt-2">{extractData?.metrics?.inference_time_seconds ? `${extractData.metrics.inference_time_seconds}s` : '-'}</div>
        </div>
        <div className="glass-card p-4 rounded flex flex-col justify-between border-t-2 border-t-accentViolet">
          <div className="text-[10px] text-textMuted font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
            <ArrowRightCircle className="w-3 h-3 text-accentViolet" /> Review Complete
          </div>
          <div className="text-3xl font-mono text-textMain leading-none mt-2">
            {reviewStats.total > 0 ? Math.round(((reviewStats.accepted + reviewStats.edited + reviewStats.rejected) / reviewStats.total) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION C: LARGE MAP PREVIEW */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="glass-card rounded-lg overflow-hidden flex-1 relative min-h-[400px] border border-border">
            <div ref={mapRef} className="absolute inset-0 bg-black" />
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(4,11,22,0.8)] z-10" />
            
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <div className="bg-background/80 backdrop-blur border border-primary/30 px-3 py-1.5 rounded text-[10px] font-bold tracking-widest uppercase text-primary">
                AI EXTRACTION PREVIEW
              </div>
              {!extractData?.source?.georeferenced && (
                <div className="bg-semantic-amber/20 backdrop-blur border border-semantic-amber/30 px-3 py-1.5 rounded text-[10px] font-bold tracking-widest uppercase text-semantic-amber">
                  NON-GEOREFERENCED
                </div>
              )}
            </div>

            <button 
              onClick={() => navigate('/review')}
              className="absolute bottom-4 right-4 z-20 px-6 py-3 bg-primary hover:bg-primaryHover text-white text-xs font-bold tracking-widest uppercase rounded shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all flex items-center gap-2"
            >
              OPEN GIS REVIEW <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* SECTION D: AI PIPELINE VISUALIZATION */}
          <div className="glass-panel p-4 rounded-lg flex items-center justify-between text-[9px] md:text-[10px] font-bold tracking-widest uppercase opacity-70">
            <div className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="w-3 h-3" /> Image</div>
            <div className="h-px flex-1 bg-border mx-2"></div>
            <div className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="w-3 h-3" /> AI Segment</div>
            <div className="h-px flex-1 bg-border mx-2"></div>
            <div className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="w-3 h-3" /> Polygonize</div>
            <div className="h-px flex-1 bg-border mx-2"></div>
            <div className="flex items-center gap-1.5 text-textMain"><ArrowRightCircle className="w-3 h-3" /> GIS Review</div>
            <div className="h-px flex-1 bg-border mx-2"></div>
            <div className="flex items-center gap-1.5 text-textMuted"><Download className="w-3 h-3" /> Export</div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          
          {/* SECTION E: REVIEW PROGRESS */}
          <div className="glass-card p-5 rounded-lg flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold tracking-widest uppercase text-textMain">Review Progress</h3>
              <span className="text-xs font-mono text-textMuted">{reviewStats.total} TOTAL</span>
            </div>
            
            <div className="flex gap-1 h-2 w-full rounded-full overflow-hidden bg-background mb-5">
              <div style={{ flex: reviewStats.accepted }} className="bg-semantic-green" />
              <div style={{ flex: reviewStats.edited }} className="bg-accentViolet" />
              <div style={{ flex: reviewStats.rejected }} className="bg-semantic-red" />
              <div style={{ flex: reviewStats.pending }} className="bg-semantic-amber" />
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between items-center bg-surface/50 p-2 rounded text-xs">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-semantic-green"></span> Accepted</span>
                <span className="font-mono">{reviewStats.accepted}</span>
              </div>
              <div className="flex justify-between items-center bg-surface/50 p-2 rounded text-xs">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accentViolet"></span> Edited</span>
                <span className="font-mono">{reviewStats.edited}</span>
              </div>
              <div className="flex justify-between items-center bg-surface/50 p-2 rounded text-xs">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-semantic-red"></span> Rejected</span>
                <span className="font-mono">{reviewStats.rejected}</span>
              </div>
              <div className="flex justify-between items-center bg-surface/50 p-2 rounded text-xs">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-semantic-amber"></span> Pending</span>
                <span className="font-mono">{reviewStats.pending}</span>
              </div>
            </div>

            <button 
              onClick={() => handleExport()}
              disabled={isExporting || (reviewStats.total - reviewStats.rejected === 0)}
              className="w-full py-2 bg-surface hover:bg-surfaceElevated border border-border text-textMain text-xs font-bold tracking-widest uppercase rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-primary" /> {isExporting ? 'EXPORTING...' : 'EXPORT REVIEWED GEOJSON'}
            </button>
          </div>

          {/* SECTION F: SPATIAL VERIFICATION */}
          <div className="glass-panel p-5 rounded-lg text-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold tracking-widest uppercase text-textMain">Spatial Verification</h3>
              {extractData?.source?.georeferenced ? (
                <span className="px-2 py-0.5 bg-semantic-green/20 text-semantic-green border border-semantic-green/30 text-[9px] font-bold tracking-widest uppercase rounded">VALID</span>
              ) : (
                <span className="px-2 py-0.5 bg-semantic-amber/20 text-semantic-amber border border-semantic-amber/30 text-[9px] font-bold tracking-widest uppercase rounded">UNAVAILABLE</span>
              )}
            </div>
            
            {extractData?.source?.georeferenced ? (
              <div className="space-y-3">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-xs text-textMuted uppercase flex items-center gap-1.5"><MapIcon className="w-3 h-3"/> CRS</span>
                  <div className="text-right">
                    <span className="font-mono text-xs block text-textMain">{extractData.source.crs || 'UNKNOWN'}</span>
                  </div>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-xs text-textMuted uppercase flex items-center gap-1.5"><ImageIcon className="w-3 h-3"/> Image Size</span>
                  <div className="text-right">
                    <span className="font-mono text-xs block text-textMain">{extractData.source.width || '-'} × {extractData.source.height || '-'}</span>
                  </div>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-xs text-textMuted uppercase flex items-center gap-1.5"><MapIcon className="w-3 h-3"/> Map Extent</span>
                  <div className="text-right">
                    <span className="font-mono text-[9px] block text-textMain break-all">
                      {extractData.source.bounds ? `[${extractData.source.bounds.map((b: number) => b.toFixed(1)).join(', ')}]` : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-textMuted uppercase flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3"/> Georeferenced</span>
                  <span className="font-mono text-xs text-textMain">YES</span>
                </div>
              </div>
            ) : (
              <div className="opacity-90">
                <div className="flex justify-between border-b border-border/50 pb-2 mb-3">
                  <span className="text-xs text-textMuted uppercase">Status</span>
                  <span className="font-mono text-[10px] text-semantic-amber uppercase">Non-Georeferenced</span>
                </div>
                <p className="text-[10px] text-textMuted leading-relaxed">
                  Spatial reference information is unavailable. Features will be rendered using local pixel coordinates.
                </p>
              </div>
            )}
          </div>

          {/* SECTION G: MODEL INFO */}
          <div className="glass-panel p-5 rounded-lg text-sm">
            <h3 className="text-xs font-bold tracking-widest uppercase text-textMain mb-4">Processing Intelligence</h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-textMuted uppercase">Model</span>
                <span className="font-mono text-xs">{extractData?.model?.architecture || 'SegFormer'}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-textMuted uppercase">Source</span>
                <span className="font-mono text-[10px] text-primary truncate max-w-[120px]" title={extractData?.model?.id}>{extractData?.model?.id}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-textMuted uppercase">Device</span>
                <span className="font-mono text-xs">{extractData?.model?.device || 'CPU'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-textMuted uppercase">Total Time</span>
                <span className="font-mono text-xs">{extractData?.metrics?.total_processing_time_seconds ? `${extractData.metrics.total_processing_time_seconds}s` : '-'}</span>
              </div>
            </div>
          </div>

          {/* SECTION G: EVALUATION */}
          <div className="glass-panel p-5 rounded-lg">
            <h3 className="text-xs font-bold tracking-widest uppercase text-textMain mb-3">Evaluation & Quality</h3>
            
            {(!metricsData || !metricsData.available) ? (
              <div className="opacity-90">
                <div className="flex justify-between items-center border-b border-border/50 pb-2 mb-3">
                  <span className="text-xs text-textMuted uppercase">Ground Truth Verification</span>
                  <span className="px-2 py-0.5 bg-semantic-amber/20 text-semantic-amber border border-semantic-amber/30 text-[9px] font-bold tracking-widest uppercase rounded">UNAVAILABLE</span>
                </div>
                <p className="text-[10px] text-textMuted leading-relaxed">
                  A corresponding building-footprint reference dataset is required for quantitative accuracy evaluation.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-semantic-green/10 border border-semantic-green/20 p-2 rounded mb-3 text-[10px] text-semantic-green font-mono uppercase">
                  Metrics Available
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-background p-2 rounded border border-border"><span className="text-textMuted uppercase block text-[9px] mb-1">IoU</span><span className="font-mono">{(metricsData.metrics.iou * 100).toFixed(1)}%</span></div>
                  <div className="bg-background p-2 rounded border border-border"><span className="text-textMuted uppercase block text-[9px] mb-1">F1 Score</span><span className="font-mono">{(metricsData.metrics.f1 * 100).toFixed(1)}%</span></div>
                  <div className="bg-background p-2 rounded border border-border"><span className="text-textMuted uppercase block text-[9px] mb-1">Precision</span><span className="font-mono">{(metricsData.metrics.precision * 100).toFixed(1)}%</span></div>
                  <div className="bg-background p-2 rounded border border-border"><span className="text-textMuted uppercase block text-[9px] mb-1">Recall</span><span className="font-mono">{(metricsData.metrics.recall * 100).toFixed(1)}%</span></div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
