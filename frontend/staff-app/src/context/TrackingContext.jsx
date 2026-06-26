import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import NoSleep from 'nosleep.js';
import { useAuth } from './AuthContext'; 

const TrackingContext = createContext(null);

export function TrackingProvider({ children }) {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [lastCoords, setLastCoords] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const noSleepRef = useRef(null);
  const lastEmitRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const lastCoordsRef = useRef(null);
  const EMIT_INTERVAL_MS = 4000;

  // Initialize NoSleep once at app root
  useEffect(() => {
    noSleepRef.current = new NoSleep();
    return () => {
      noSleepRef.current?.disable();
    };
  }, []);

  const stopTracking = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log("[Global Tracking] Notifying backend shift ended...");
      if (user?.role === 'DRIVER') {
        socketRef.current.emit('driver_shift_end', { vehicleId: user?.vehicleId });
      } else {
        socketRef.current.emit('staff_shift_end', { staffId: user?.id || user?._id });
      }
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    try {
      noSleepRef.current?.disable();
    } catch (err) {
      console.warn('NoSleep disable failed:', err);
    }

    localStorage.removeItem('staff_on_shift');
    setIsTracking(false);
    setLastCoords(null);
    setIsConnected(false);
    console.log("🧹 Global Tracking Stopped & Cleared.");
  }, [user]);

  const startTracking = useCallback(() => {
    if (isTracking) return;
    if (!navigator.geolocation) return;

    localStorage.setItem('staff_on_shift', 'true');

    try {
      noSleepRef.current?.enable();
    } catch (err) {
      console.warn('NoSleep enable failed:', err);
    }

    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
    const socket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      // SECURITY: Auth via HttpOnly cookie, not token in socket auth payload
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socketRef.current = socket;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLastCoords({ lat: latitude, lng: longitude });
        lastCoordsRef.current = { lat: latitude, lng: longitude };
        setIsTracking(true);

        const now = Date.now();
        if (socketRef.current?.connected && now - lastEmitRef.current >= EMIT_INTERVAL_MS) {
          lastEmitRef.current = now;
          if (user?.role === 'DRIVER') {
            socketRef.current.emit('driver_location_update', {
              vehicleId: user?.vehicleId,
              lat: latitude,
              lng: longitude,
              timestamp: new Date().toISOString(),
            });
          } else {
            socketRef.current.emit('staff_location_update', {
              staffId: user?.id || user?._id, 
              name: user?.name || user?.username || 'Field Staff',
              role: user?.role || 'STAFF',
              lat: latitude,
              lng: longitude,
              timestamp: new Date().toISOString(),
            });
          }
        }
      },
      (error) => {
        console.error('Global Geolocation error:', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          stopTracking();
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    watchIdRef.current = watchId;
    setIsTracking(true);

    // Ensure we keep sending our last known location even if watchPosition doesn't fire (e.g. standing still)
    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const coords = lastCoordsRef.current;
      if (socketRef.current?.connected && coords && now - lastEmitRef.current >= EMIT_INTERVAL_MS) {
        lastEmitRef.current = now;
        if (user?.role === 'DRIVER') {
          socketRef.current.emit('driver_location_update', {
            vehicleId: user?.vehicleId,
            lat: coords.lat,
            lng: coords.lng,
            timestamp: new Date().toISOString(),
          });
        } else {
          socketRef.current.emit('staff_location_update', {
            staffId: user?.id || user?._id, 
            name: user?.name || user?.username || 'Field Staff',
            role: user?.role || 'STAFF',
            lat: coords.lat,
            lng: coords.lng,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }, EMIT_INTERVAL_MS);

  }, [user, isTracking, stopTracking]);

  // 🔄 Auto-Resume engine across page reloads
  useEffect(() => {
    const wasOnShift = localStorage.getItem('staff_on_shift') === 'true';
    if (wasOnShift && user && !isTracking) {
      console.log("🔄 Background shift recovery running...");
      startTracking();
    }
  }, [user, isTracking, startTracking]);

  return (
    <TrackingContext.Provider value={{ isTracking, lastCoords, isConnected, startTracking, stopTracking }}>
      {children}
    </TrackingContext.Provider>
  );
}

export const useTracking = () => useContext(TrackingContext);