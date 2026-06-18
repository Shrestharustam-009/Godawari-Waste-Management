const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ select: { username: true, role: true } });
  console.log("Users:", users);
  const customers = await prisma.customer.findMany({ select: { customerId: true, name: true, phone: true } });
  console.log("Customers count:", customers.length);
  if (customers.length > 0) {
    console.log("Sample customer:", customers[0]);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
