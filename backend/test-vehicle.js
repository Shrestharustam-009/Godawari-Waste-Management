const prisma = require('./src/lib/prisma');

async function checkVehicle() {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: 3 },
    include: { assignedUsers: true }
  });
  console.log('Vehicle 3:', JSON.stringify(vehicle, null, 2));
}

checkVehicle().catch(console.error).finally(() => process.exit());
