// ============================================================================
// WEBSOCKET CONFIGURATION (socket.io)
// ============================================================================
// Handles real-time GPS tracking for the 'Fleet Map & HR' module.
// 
// ARCHITECTURE DESIGN:
// 1. High-frequency coordinates are broadcasted instantly to the generic
//    'map_updates' room so the frontend React app can render live movement.
// 2. We explicitly AVOID saving every single ping to PostgreSQL to prevent
//    database lag and row bloat. (Only batch route histories are saved if needed).
// ============================================================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

// The same secret used in src/utils/token.js
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION_IMMEDIATELY';

let io;

/**
 * Initializes the socket.io server and attaches it to the existing HTTP server.
 * Sets up CORS and establishes the 'map_updates' broadcasting channels.
 * 
 * @param {import('http').Server} httpServer The Node.js HTTP server
 */
function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*', // Specify frontend origin in production
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION MIDDLEWARE
  // ────────────────────────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      if (!cookieHeader) {
        return next(new Error('Authentication Error: No Cookie Header'));
      }

      const cookies = cookie.parse(cookieHeader);
      const token = cookies.accessToken;

      if (!token) {
        return next(new Error('Authentication Error: No Access Token'));
      }

      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
      
      // Attach the verified user payload to the socket
      socket.user = decoded;
      next();
    } catch (err) {
      console.error('[SOCKET AUTH] Unauthorized connection attempt:', err.message);
      return next(new Error('Authentication Error: Invalid Token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id} (Role: ${socket.user.role})`);

    // ────────────────────────────────────────────────────────────────────────
    // STRICT ROLE-BASED ROOM ASSIGNMENT
    // ────────────────────────────────────────────────────────────────────────
    // Admins are automatically joined to the secure admin_room.
    // We DO NOT trust the client to ask to join; the server forces it.
    if (socket.user.role === 'ADMIN') {
      socket.join('admin_room');
      console.log(`[SOCKET] Admin ${socket.user.username || socket.user.id} forcefully joined 'admin_room'.`);
    }

    // All clients who want to view the map should join the map_updates room
    socket.on('join_map', () => {
      socket.join('map_updates');
      console.log(`[SOCKET] Client ${socket.id} joined 'map_updates' room.`);
    });

    // ────────────────────────────────────────────────────────────────────────
    // LIVE GPS CHANNELS (Broadcasting only — No DB writes)
    // ────────────────────────────────────────────────────────────────────────

    // 1. Fleet Vehicle GPS Update
    socket.on('driver_location_update', (data) => {
      // data expects: { vehicleId: number, lat: number, lng: number }
      
      // Instantly broadcast the coordinate payload to all clients in the map room
      socket.to('map_updates').emit('live_driver_location', {
        vehicleId: data.vehicleId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      });
    });

    // 2. Staff GPS Update (Walking/Field App)
    socket.on('staff_location_update', (data) => {
      // data expects: { staffId: number, lat: number, lng: number }

      // Instantly broadcast the coordinate payload to all clients in the map room
      socket.to('map_updates').emit('live_staff_location', {
        staffId: data.staffId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[SOCKET] WebSocket server initialized successfully.');
}

/**
 * Helper to get the socket.io instance from other files if needed.
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
}

module.exports = {
  initSocketServer,
  getIO,
};
