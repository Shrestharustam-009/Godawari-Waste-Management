const prisma = require('./src/lib/prisma');

async function test() {
  // 1. Fetch latest driver locations
  const locations = await prisma.latestDriverLocation.findMany();
  console.log('Locations:', locations);

  // 2. Fetch corresponding vehicle details and assigned users
  const vehicleIds = locations.map(loc => loc.vehicleId);
  const vehicles = await prisma.vehicle.findMany({
    where: { vehicleId: { in: vehicleIds } },
    select: {
      vehicleId: true,
      registrationNumber: true,
      type: true,
      assignedUsers: {
        select: { name: true, role: true }
      }
    }
  });
  console.log('Vehicles:', JSON.stringify(vehicles, null, 2));

  // 3. Map the data together
  const driverData = locations.map(loc => {
    const vehicle = vehicles.find(v => v.vehicleId === loc.vehicleId);
    // Find the currently assigned driver from the vehicle's assignedUsers relation
    const assignedDriver = vehicle?.assignedUsers?.find(u => u.role === 'DRIVER');
    
    return {
      vehicleId: loc.vehicleId,
      driverName: assignedDriver ? assignedDriver.name : 'Unknown Driver',
      plateNumber: vehicle?.registrationNumber || 'Unknown',
      vehicleType: vehicle?.type || 'Vehicle',
      lat: loc.lat,
      lng: loc.lng,
      timestamp: loc.updatedAt
    };
  });
  
  console.log('Final Data:', JSON.stringify(driverData, null, 2));
}

test().catch(console.error).finally(() => process.exit());
