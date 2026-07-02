const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 15 });
  console.log(logs);
}
main();
