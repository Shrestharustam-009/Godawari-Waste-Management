import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { MapPin, Navigation, Focus, Loader2 } from 'lucide-react';
import api from '../api/axios';
import 'leaflet/dist/leaflet.css';

const truckIconHtml = `
  <div style="background-color: #10b981; border: 2px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"></path><path d="M14 17h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>
    </svg>
  </div>
`;

const truckIcon = new L.DivIcon({
  html: truckIconHtml,
  className: 'custom-leaflet-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const offlineIconHtml = `
  <div style="background-color: #94a3b8; border: 2px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); opacity: 0.7;">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 17h4V5H2v12h3"></path><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"></path><path d="M14 17h1"></path><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>
    </svg>
  </div>
`;

const offlineIcon = new L.DivIcon({
  html: offlineIconHtml,
  className: 'custom-leaflet-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

// ── Helper Component to programmatically control the map ──
function MapController({ center, zoom, bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    } else if (center) {
      map.flyTo(center, zoom || 15, { duration: 1.5 });
    }
  }, [center, zoom, bounds, map]);
  return null;
}

// Center map on Godawari, Nepal
const centerPosition = [27.65, 85.35]; 

export default function CustomerMap() {
  const [driverMarkers, setDriverMarkers] = useState({});
  const [mapCenter, setMapCenter] = useState(centerPosition);
  const [mapZoom, setMapZoom] = useState(13);
  const [mapBounds, setMapBounds] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const socketRef = useRef(null);
  
  useEffect(() => {
    // 1. Fetch initial locations
    const fetchInitialLocations = async () => {
      try {
        const res = await api.get('/customers/latest-locations');
        if (res.data?.success) {
          setDriverMarkers(prev => {
            const next = { ...prev };
            res.data.drivers.forEach(d => {
              if (!next[d.vehicleId]) {
                next[d.vehicleId] = {
                  lat: d.lat,
                  lng: d.lng,
                  plateNumber: d.plateNumber,
                  driverName: d.driverName,
                  driverPhone: d.driverPhone,
                  timestamp: new Date(d.timestamp).getTime(),
                };
              } else {
                // If a live socket ping arrived first, just inject the missing metadata
                next[d.vehicleId] = {
                  ...next[d.vehicleId],
                  plateNumber: d.plateNumber,
                  driverName: d.driverName,
                  driverPhone: d.driverPhone,
                };
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to load initial driver locations:', err);
      }
    };

    fetchInitialLocations();

    // 2. Setup Socket
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server');
      socket.emit('join_customer_map');
    });

    socket.on('live_driver_location', (data) => {
      setDriverMarkers(prev => {
        const existing = prev[data.vehicleId] || {};
        // The API returns plateNumber, so if it's missing from the socket update, we keep the existing metadata
        return {
          ...prev,
          [data.vehicleId]: {
            ...existing,
            lat: data.lat,
            lng: data.lng,
            timestamp: Date.now(),
            isStale: false
          }
        };
      });
    });

    socket.on('driver_went_offline', (data) => {
      setDriverMarkers(prev => {
        const next = { ...prev };
        delete next[data.vehicleId];
        return next;
      });
    });

    // 3. Stale data sweeper
    const sweeper = setInterval(() => {
      const now = Date.now();
      setDriverMarkers(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [id, marker] of Object.entries(next)) {
          if (now - marker.timestamp > STALE_THRESHOLD_MS && !marker.isStale) {
            next[id] = { ...marker, isStale: true };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 30000);

    return () => {
      clearInterval(sweeper);
      socket.disconnect();
    };
  }, []);

  const handleFitVehicles = () => {
    const markers = Object.values(driverMarkers);
    if (markers.length === 0) return;
    
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
    setMapCenter(null); // Clear center to prioritize bounds
    setMapBounds(bounds);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapBounds(null); // Clear bounds to prioritize center
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setMapZoom(15);
        setIsLocating(false);
      },
      () => {
        alert("Unable to retrieve your location. Please check your permissions.");
        setIsLocating(false);
      }
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6 mb-6">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Live Vehicle Tracking</h2>
          <p className="text-sm text-slate-500">Track our collection vehicles in real-time</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleFitVehicles}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200"
          >
            <Focus className="w-3.5 h-3.5" /> Fit Vehicles
          </button>
          <button 
            onClick={handleLocateMe}
            disabled={isLocating}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-emerald-200"
          >
            {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />} 
            {isLocating ? 'Locating...' : 'Locate Me'}
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1 hidden md:block"></div>
          <div className="flex items-center gap-1 text-xs font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span> Active
          </div>
          <div className="flex items-center gap-1 text-xs font-medium ml-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 block"></span> Offline
          </div>
        </div>
      </div>
      
      <div style={{ height: '400px', width: '100%', zIndex: 1 }} className="relative">
        <MapContainer center={centerPosition} zoom={13} style={{ height: '100%', width: '100%' }}>
          <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {Object.entries(driverMarkers).map(([id, marker]) => (
            <Marker 
              key={id} 
              position={[marker.lat, marker.lng]} 
              icon={marker.isStale ? offlineIcon : truckIcon}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold text-slate-800 border-b pb-1 mb-1">Vehicle Tracking</div>
                  <div><span className="text-slate-500 text-xs">Driver:</span> {marker.driverName || 'Unknown'}</div>
                  {marker.driverPhone && (
                    <div><span className="text-slate-500 text-xs">Phone:</span> {marker.driverPhone}</div>
                  )}
                  <div><span className="text-slate-500 text-xs">Vehicle:</span> {marker.plateNumber || 'Unknown'}</div>
                  {marker.isStale && <div className="text-red-500 text-xs mt-1 font-bold">Offline (Last seen &gt;3 mins ago)</div>}
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                {marker.plateNumber || 'Vehicle'}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
