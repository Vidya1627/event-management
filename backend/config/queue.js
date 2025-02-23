const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redisOptions = {
    host: "127.0.0.1",
    port: 6379,
    maxRetriesPerRequest: null, // ✅ Ensures BullMQ works properly
    enableReadyCheck: false     // ✅ Prevents connection issues
};

const redisConnection = new Redis(redisOptions);

// Create a queue for duplicate detection
const duplicateQueue = new Queue('duplicateCheckQueue', { connection: redisConnection });

module.exports = duplicateQueue;
