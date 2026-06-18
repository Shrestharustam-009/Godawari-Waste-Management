const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const incCats = await prisma.incomeCategory.findMany();
  console.log("Income Categories:", incCats.map(c => c.name));
}

check().catch(console.error).finally(() => prisma.$disconnect());
