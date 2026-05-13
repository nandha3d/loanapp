const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('Prisma models:');
const models = Object.keys(prisma).filter(k => !k.startsWith('_') && typeof prisma[k] === 'object');
console.log(models);

if (prisma.tenantSubscription) {
    console.log('tenantSubscription exists');
} else {
    console.log('tenantSubscription MISSING');
}

if (prisma.appSetting) {
    console.log('appSetting exists');
} else {
    console.log('appSetting MISSING');
}
