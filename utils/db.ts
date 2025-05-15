import { PrismaClient } from "@prisma/client";
import { withAccelerate } from '@prisma/extension-accelerate';
// import "server-only";
 
declare global {
  // eslint-disable-next-line no-var, no-unused-vars
  var cachedPrisma: PrismaClient;
}

// Creating Prisma client instance with optimized connection handling
export let db: PrismaClient;
if (process.env.NODE_ENV === "production") {
  // In production, use connection pooling optimizations and Prisma Accelerate if available
  const client = new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  db = client.$extends(withAccelerate()) as unknown as PrismaClient;
} else {
  // In development, reuse connections to avoid exhausting the pool
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient();
  }
  db = global.cachedPrisma;
}

// Helper function to handle database operations with retry logic
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on connection-related errors
      if (
        !error.message.includes('connection') &&
        !error.message.includes('timeout') &&
        !error.message.includes('pool')
      ) {
        throw error;
      }
      
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
      
      if (attempt < maxRetries) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  throw lastError;
}