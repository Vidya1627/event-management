const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redisConnection = new Redis(); // Connect to Redis

// Create a queue for duplicate detection
const duplicateQueue = new Queue('duplicateCheckQueue', {
    connection: redisConnection
});

module.exports = duplicateQueue;
