// ============================================================================
// WEBSOCKET CONFIGURATION (socket.io) — Security-Hardened
// ============================================================================
// SECURITY CHANGES:
//   1. Role-gated room joining (join_admin requires ADMIN, join_map requires ADMIN/STAFF)
//   2. GPS payload validation (lat/lng bounds, rate limiting)
//   3. CORS origins from environment (no wildcard)
//   4. JWT verification on handshake
// ============================================================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;

let io;

// ── GPS payload validation ──
function isValidGPS(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

// ── Per-socket rate limiting for GPS emissions ──
const GPS_MIN_INTERVAL_MS = 3000; // Max 1 GPS update per 3 seconds

function initSocketServer(httpServer) {
  // Parse allowed origins from environment
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION MIDDLEWARE — JWT from HttpOnly cookie
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

      if (!ACCESS_TOKEN_SECRET) {
        return next(new Error('Authentication Error: Server misconfigured'));
      }

      const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
      socket.user = decoded;
      socket._lastGPSEmit = 0; // Initialize rate limiter
      next();
    } catch (err) {
      console.error('[SOCKET AUTH] Unauthorized connection attempt:', err.message);
      return next(new Error('Authentication Error: Invalid Token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id} (Role: ${socket.user.role})`);

    // ── 1. FORCE ASSIGNMENT BY ROLE (Server-side) ──
    if (socket.user.role === 'ADMIN') {
      socket.join('admin_room');
      socket.join('map_updates');
      console.log(`[SOCKET] Admin ${socket.user.username || socket.user.id} auto-joined rooms.`);
    }

    // ── 2. ROLE-GATED ROOM JOINING ──
    socket.on('join_map', () => {
      // SECURITY: Only ADMIN and STAFF can view the live map
      if (!['ADMIN', 'STAFF'].includes(socket.user.role)) {
        socket.emit('error_message', { error: 'Access denied: insufficient role for map access.' });
        console.warn(`[SOCKET] Role '${socket.user.role}' denied join_map (socket: ${socket.id})`);
        return;
      }
      socket.join('map_updates');
      console.log(`[SOCKET] Client ${socket.id} joined 'map_updates' room.`);
    });

    socket.on('join_admin', () => {
      // SECURITY: Only ADMIN can join admin_room
      if (socket.user.role !== 'ADMIN') {
        socket.emit('error_message', { error: 'Access denied: ADMIN role required.' });
        console.warn(`[SOCKET] Role '${socket.user.role}' denied join_admin (socket: ${socket.id})`);
        return;
      }
      socket.join('admin_room');
      socket.join('map_updates');
      console.log(`[SOCKET] Client ${socket.id} joined 'admin_room' via join_admin.`);
    });

    socket.on('join_customer_map', () => {
      // SECURITY: CUSTOMER and ADMIN can join customer_map_updates
      if (!['ADMIN', 'CUSTOMER'].includes(socket.user.role)) {
        socket.emit('error_message', { error: 'Access denied: insufficient role for customer map access.' });
        console.warn(`[SOCKET] Role '${socket.user.role}' denied join_customer_map (socket: ${socket.id})`);
        return;
      }
      socket.join('customer_map_updates');
      console.log(`[SOCKET] Client ${socket.id} joined 'customer_map_updates' room.`);
    });

    // ── 3. Fleet Vehicle GPS Update ──
    socket.on('driver_location_update', async (data) => {
      // Rate limiting
      const now = Date.now();
      if (now - socket._lastGPSEmit < GPS_MIN_INTERVAL_MS) return;
      socket._lastGPSEmit = now;

      // Validate GPS data
      if (!isValidGPS(data?.lat, data?.lng)) {
        return; // Silently drop invalid payloads
      }

      let verifiedVehicleId = String(data.vehicleId || socket.user?.vehicleId || 'unknown');
      
      // Lazy load from DB if missing (e.g. stale token)
      if (verifiedVehicleId === 'unknown' && socket.user?.id) {
        try {
          const dbUser = await prisma.user.findUnique({ 
            where: { id: parseInt(socket.user.id, 10) }, 
            select: { vehicleId: true } 
          });
          if (dbUser && dbUser.vehicleId) {
            verifiedVehicleId = String(dbUser.vehicleId);
            socket.user.vehicleId = dbUser.vehicleId; // Cache it on the socket to prevent future DB hits
          }
        } catch (err) {
          console.error('[SOCKET DB] Failed to resolve vehicleId:', err.message);
        }
      }

      // If they still don't have a vehicle assigned, drop the packet to prevent "unknown" ghost markers
      if (verifiedVehicleId === 'unknown') {
        return;
      }

      const updatePacket = {
        vehicleId: verifiedVehicleId,
        driverId: socket.user?.id,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      };

      io.to('map_updates').to('admin_room').to('customer_map_updates').emit('live_driver_location', updatePacket);

      try {
        await prisma.latestDriverLocation.upsert({
          where: { vehicleId: verifiedVehicleId },
          update: { lat: data.lat, lng: data.lng, updatedAt: new Date() },
          create: { vehicleId: verifiedVehicleId, lat: data.lat, lng: data.lng },
        });
      } catch (err) {
        console.error(`[PRISMA ERROR] Failed to cache location for vehicle ${verifiedVehicleId}:`, err.message);
      }
    });

    // ── 4. Staff GPS Update ──
    socket.on('staff_location_update', async (data) => {
      const now = Date.now();
      if (now - socket._lastGPSEmit < GPS_MIN_INTERVAL_MS) return;
      socket._lastGPSEmit = now;

      if (!isValidGPS(data?.lat, data?.lng)) return;

      // SECURITY: Use the authenticated user's ID, not client-supplied staffId
      const verifiedStaffId = parseInt(socket.user?.id, 10);
      if (isNaN(verifiedStaffId)) return;

      const updatePacket = {
        staffId: verifiedStaffId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      };

      io.to('map_updates').to('admin_room').emit('live_staff_location', updatePacket);

      try {
        await prisma.latestStaffLocation.upsert({
          where: { staffId: verifiedStaffId },
          update: { lat: data.lat, lng: data.lng, updatedAt: new Date() },
          create: { staffId: verifiedStaffId, lat: data.lat, lng: data.lng },
        });
      } catch (err) {
        console.error(`[PRISMA ERROR] Failed to cache location for staff ${verifiedStaffId}:`, err.message);
      }
    });

    // ── 5. Staff Ends Shift ──
    socket.on('staff_shift_end', async (data) => {
      const verifiedStaffId = parseInt(socket.user?.id, 10);
      if (isNaN(verifiedStaffId)) return;

      try {
        await prisma.latestStaffLocation.deleteMany({ where: { staffId: verifiedStaffId } });
        io.to('map_updates').to('admin_room').emit('staff_went_offline', { staffId: verifiedStaffId });
        console.log(`[SHIFT END] Cleared live tracking for staff: ${verifiedStaffId}`);
      } catch (err) {
        console.error('[PRISMA ERROR] Failed to clear offline staff member:', err.message);
      }
    });

    // ── 6. Driver Ends Shift ──
    socket.on('driver_shift_end', async (data) => {
      const verifiedVehicleId = String(data.vehicleId || socket.user?.vehicleId || 'unknown');

      try {
        await prisma.latestDriverLocation.deleteMany({ where: { vehicleId: verifiedVehicleId } });
        io.to('map_updates').to('admin_room').to('customer_map_updates').emit('driver_went_offline', { vehicleId: verifiedVehicleId });
        console.log(`[SHIFT END] Cleared live tracking for vehicle: ${verifiedVehicleId}`);
      } catch (err) {
        console.error('[PRISMA ERROR] Failed to clear offline vehicle:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[SOCKET] WebSocket server initialized successfully.');
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
}

module.exports = { initSocketServer, getIO };
