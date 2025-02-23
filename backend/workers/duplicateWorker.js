const { Worker } = require('bullmq');
const Redis = require('ioredis');

const redisOptions = {
    host: "127.0.0.1",
    port: 6379,
    maxRetriesPerRequest: null, // ✅ Ensures BullMQ works properly
    enableReadyCheck: false     // ✅ Prevents connection issues
};

const worker = new Worker('duplicateCheckQueue', async (job) => {
    console.log(`Processing job: ${job.id}`);
    
    // Simulate AI duplicate check
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`Job completed: ${job.id}`);
}, {
    connection: new Redis(redisOptions) // ✅ Ensure Worker has the correct Redis options
});

worker.on('completed', job => {
    console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err);
});
