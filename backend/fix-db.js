const prisma = require('./src/lib/prisma');

async function fixDB() {
  await prisma.latestDriverLocation.deleteMany({
    where: { vehicleId: 'unknown' }
  });
  console.log('Deleted unknown markers');
}

fixDB().catch(console.error).finally(() => process.exit());
