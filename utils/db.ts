import { PrismaClient } from "@prisma/client";
// import "server-only";
 
declare global {
  // eslint-disable-next-line no-var, no-unused-vars
  var cachedPrisma: PrismaClient;
}

// Creating Prisma client instance for using it with db
export let db: PrismaClient;
if (process.env.NODE_ENV === "production") {
  db = new PrismaClient();
} else {
  if (!global.cachedPrisma) { // looking for if there is already a prisma instance
    global.cachedPrisma = new PrismaClient();
  }
  db = global.cachedPrisma;
}