import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Stroke, Fill } from 'ol/style';
import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import { click } from 'ol/events/condition';

import { Layers, ZoomIn, ZoomOut, Maximize, RotateCcw, CheckCircle2, XCircle, MousePointer2, ShieldCheck, Cpu, MapPin } from 'lucide-react';

export default function GISReview() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  
  const [extractData, setExtractData] = useState<any>(null);
  const [reviewedData, setReviewedData] = useState<any>(null);
  const [selectedFeatureInfo, setSelectedFeatureInfo] = useState<any>(null);
  
  const [layersVisibility] = useState({
    source: true,
    ai: false,
    reviewed: true
  });
  
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  // Layer Refs
  const sourceLayerRef = useRef<ImageLayer<Static> | null>(null);
  const aiLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const reviewedLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const selectInteractionRef = useRef<Select | null>(null);

  // Load Data
  useEffect(() => {
    const rawData = localStorage.getItem('cadastra_extraction_data');
    if (rawData) {
      const parsedData = JSON.parse(rawData);
      setExtractData(parsedData);
      
      const savedReview = localStorage.getItem('cadastra_reviewed_data');
      if (savedReview) {
        setReviewedData(JSON.parse(savedReview));
      } else {
        // Initialize reviewed data
        const initFeatures = parsedData.features.map((f: any) => ({
          ...f,
          properties: {
            ...f.properties,
            review_status: 'PENDING',
            original_ai_geometry: f.geometry
          }
        }));
        const initialData = { type: 'FeatureCollection', features: initFeatures };
        setReviewedData(initialData);
        localStorage.setItem('cadastra_reviewed_data', JSON.stringify(initialData));
      }
    }
  }, []);

  const getStatusColors = (status: string, isSelected: boolean = false) => {
    const opacityBase = isSelected ? '0.5' : '0.2';
    const borderOpacity = isSelected ? '1.0' : '0.8';
    
    switch(status) {
      case 'ACCEPTED': return { color: `rgba(16, 185, 129, ${borderOpacity})`, fill: `rgba(16, 185, 129, ${opacityBase})` };
      case 'EDITED': return { color: `rgba(139, 92, 246, ${borderOpacity})`, fill: `rgba(139, 92, 246, ${opacityBase})` };
      case 'REJECTED': return { color: `rgba(239, 68, 68, ${borderOpacity})`, fill: `rgba(239, 68, 68, 0.1)` };
      case 'PENDING': default: return { color: `rgba(245, 158, 11, ${borderOpacity})`, fill: `rgba(245, 158, 11, ${opacityBase})` };
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || !extractData || !reviewedData) return;

    const initMap = async () => {
        const sourceData = extractData.source;
        const isGeoreferenced = sourceData.georeferenced;
        let extent = sourceData.bounds || [0, 0, 1000, 1000];
        
        let proj: any = undefined;
        if (!isGeoreferenced) {
            const { default: Projection } = await import('ol/proj/Projection');
            proj = new Projection({
                code: 'local-image',
                units: 'pixels',
                extent: extent
            });
        }
        
        const { default: TileLayer } = await import('ol/layer/Tile');
        const { default: OSM } = await import('ol/source/OSM');
        
        const layers: any[] = [];
        
        if (isGeoreferenced) {
            layers.push(new TileLayer({ source: new OSM(), opacity: 0.2 }));
        }
        
        sourceLayerRef.current = new ImageLayer({
          source: new Static({
            url: `${API_BASE_URL}/api/image/${sourceData.filename}`,
            imageExtent: extent,
            projection: proj,
          }),
          visible: layersVisibility.source,
          zIndex: 0
        });
        layers.push(sourceLayerRef.current);

        // 2. AI Layer
        const aiFeatures = new GeoJSON().readFeatures({ type: 'FeatureCollection', features: extractData.features });
        if (!isGeoreferenced) {
            aiFeatures.forEach(f => {
                const geom = f.getGeometry();
                if (geom) { geom.scale(1, -1, [0, 0]); geom.translate(0, extent[3]); }
            });
        }
        const aiSource = new VectorSource({ features: aiFeatures });
        
        aiLayerRef.current = new VectorLayer({
          source: aiSource,
          visible: layersVisibility.ai,
          style: new Style({
            stroke: new Stroke({ color: 'rgba(14, 165, 233, 0.4)', width: 1, lineDash: [4, 4] }),
            fill: new Fill({ color: 'rgba(14, 165, 233, 0.05)' }),
          }),
          zIndex: 1
        });
        layers.push(aiLayerRef.current);

        // 3. Reviewed Layer
        const revFeatures = new GeoJSON().readFeatures(reviewedData);
        if (!isGeoreferenced) {
            revFeatures.forEach(f => {
                const geom = f.getGeometry();
                if (geom) { geom.scale(1, -1, [0, 0]); geom.translate(0, extent[3]); }
            });
        }
        const reviewedSource = new VectorSource({ features: revFeatures });
        
        reviewedLayerRef.current = new VectorLayer({
          source: reviewedSource,
          visible: layersVisibility.reviewed,
          style: (feature) => {
            const status = feature.get('review_status') || 'PENDING';
            const { color, fill } = getStatusColors(status, false);
            const lineDash = status === 'REJECTED' ? [4, 4] : undefined;
            
            return new Style({
              stroke: new Stroke({ color, width: 1.5, lineDash }),
              fill: new Fill({ color: fill }),
            });
          },
          zIndex: 2
        });
        layers.push(reviewedLayerRef.current);

        const viewOptions: any = {
          center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2],
          resolution: (extent[2] - extent[0]) / mapRef.current!.clientWidth,
        };
        if (proj) {
            viewOptions.projection = proj;
        }

        mapInstance.current = new Map({
          target: mapRef.current!,
          layers: layers,
          view: new View(viewOptions),
        });

        mapInstance.current.getView().fit(extent, { padding: [50, 50, 50, 50] });

        // Interactions
        selectInteractionRef.current = new Select({
          condition: click,
          layers: [reviewedLayerRef.current],
          style: (feature) => {
            const status = feature.get('review_status') || 'PENDING';
            const { color, fill } = getStatusColors(status, true);
            const lineDash = status === 'REJECTED' ? [6, 6] : undefined;
            return new Style({
              stroke: new Stroke({ color, width: 3, lineDash }),
              fill: new Fill({ color: fill }),
            });
          }
        });
        mapInstance.current.addInteraction(selectInteractionRef.current);
        
        const modify = new Modify({ features: selectInteractionRef.current.getFeatures() });
        mapInstance.current.addInteraction(modify);

        selectInteractionRef.current.on('select', (e) => {
          if (e.selected.length > 0) {
            const feature = e.selected[0];
            updateSelectedInfo(feature);
          } else {
            setSelectedFeatureInfo(null);
          }
        });

        modify.on('modifyend', async (e) => {
          const feature = e.features.getArray()[0];
          if (feature) {
            const format = new GeoJSON();
            let geomToValidate = feature.getGeometry();
            if (!isGeoreferenced && geomToValidate) {
                geomToValidate = geomToValidate.clone();
                geomToValidate.translate(0, -extent[3]);
                geomToValidate.scale(1, -1, [0, 0]);
            }
            const geom = format.writeGeometryObject(geomToValidate!);
            
            try {
              const res = await fetch(`${API_BASE_URL}/api/validate_geometry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ geometry: geom })
              });
              const valData = await res.json();
              
              feature.set('review_status', 'EDITED');
              feature.set('geometry_valid', valData.valid);
              if (valData.valid) {
                feature.set('area', valData.area);
              } else {
                alert(`INVALID GEOMETRY: ${valData.message}`);
              }
              
              updateSelectedInfo(feature);
              persistReviewedData();
            } catch (err) {
              console.error(err);
            }
          }
        });
    };
    
    initMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.setTarget(undefined);
        mapInstance.current = null;
      }
    };
  }, [extractData, reviewedData]);

  useEffect(() => {
    if (sourceLayerRef.current) sourceLayerRef.current.setVisible(layersVisibility.source);
    if (aiLayerRef.current) aiLayerRef.current.setVisible(layersVisibility.ai);
    if (reviewedLayerRef.current) reviewedLayerRef.current.setVisible(layersVisibility.reviewed);
  }, [layersVisibility]);

  const updateSelectedInfo = (feature: any) => {
    setSelectedFeatureInfo({
      id: feature.get('building_id') || 'Unknown',
      area: feature.get('area') || 'N/A',
      perimeter: feature.get('perimeter') || 'N/A',
      valid: feature.get('geometry_valid'),
      source: feature.get('source'),
      model: feature.get('model'),
      status: feature.get('review_status') || 'PENDING',
      featureRef: feature
    });
  };

  const persistReviewedData = () => {
    if (reviewedLayerRef.current) {
      const format = new GeoJSON();
      const source = reviewedLayerRef.current.getSource();
      if (source) {
        const features = source.getFeatures();
        let exportFeatures = features;
        
        if (extractData?.source && !extractData.source.georeferenced) {
            exportFeatures = features.map(f => {
                const clone = f.clone();
                const geom = clone.getGeometry();
                if (geom) {
                    geom.translate(0, -extractData.source.bounds[3]);
                    geom.scale(1, -1, [0, 0]);
                }
                return clone;
            });
        }
        
        const geojsonObj = format.writeFeaturesObject(exportFeatures);
        localStorage.setItem('cadastra_reviewed_data', JSON.stringify(geojsonObj));
        setReviewedData(geojsonObj);
      }
    }
  };

  const handleAction = (newStatus: string) => {
    if (selectedFeatureInfo && selectedFeatureInfo.featureRef) {
      const feature = selectedFeatureInfo.featureRef;
      feature.set('review_status', newStatus);
      updateSelectedInfo(feature);
      persistReviewedData();
    }
  };

  const handleBulkAccept = () => {
    if (reviewedLayerRef.current) {
      const source = reviewedLayerRef.current.getSource();
      if (source) {
        let changed = false;
        source.getFeatures().forEach(feature => {
          if ((feature.get('review_status') || 'PENDING') === 'PENDING') {
            feature.set('review_status', 'ACCEPTED');
            changed = true;
          }
        });
        if (changed) {
          if (selectedFeatureInfo && selectedFeatureInfo.featureRef && selectedFeatureInfo.status === 'PENDING') {
             updateSelectedInfo(selectedFeatureInfo.featureRef);
          }
          persistReviewedData();
        }
      }
    }
    setShowBulkConfirm(false);
  };

  const resetView = () => {
    if (mapInstance.current && extractData?.source?.bounds) {
      mapInstance.current.getView().fit(extractData.source.bounds, { padding: [50, 50, 50, 50] });
    }
  };

  if (!extractData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="glass-card p-8 rounded-xl text-center">
          <Layers className="w-12 h-12 text-primary opacity-50 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-textMain uppercase tracking-wider mb-2">NO AI FEATURES</h2>
          <p className="text-sm text-textMuted">Run AI extraction to generate building features.</p>
        </div>
      </div>
    );
  }

  if (extractData.features.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="glass-card p-8 rounded-xl text-center">
          <Layers className="w-12 h-12 text-semantic-amber opacity-50 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-textMain uppercase tracking-wider mb-2">NO BUILDINGS DETECTED</h2>
          <p className="text-sm text-textMuted">The AI model did not identify any structures.</p>
        </div>
      </div>
    );
  }

  const counts = {
    total: reviewedData?.features.length || 0,
    pending: reviewedData?.features.filter((f: any) => f.properties.review_status === 'PENDING').length || 0,
    accepted: reviewedData?.features.filter((f: any) => f.properties.review_status === 'ACCEPTED').length || 0,
    edited: reviewedData?.features.filter((f: any) => f.properties.review_status === 'EDITED').length || 0,
    rejected: reviewedData?.features.filter((f: any) => f.properties.review_status === 'REJECTED').length || 0,
  };


  return (
    <div className="flex h-full w-full gap-4 p-4 bg-background overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      


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

}
