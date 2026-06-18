const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany({ where: { vehicleId: null } });
  for (const v of vehicles) {
    await prisma.vehicle.update({
      where: { id: v.id },
      data: { vehicleId: `V-${v.id}` }
    });
  }
  console.log(`Updated ${vehicles.length} vehicles.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
