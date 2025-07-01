const { MongoClient } = require('mongodb')
const collection = require('./collections')
const state = {
    db: null,
    client: null
}

module.exports.connect = async function () {
    const maxRetries = 3;
    let retryCount = 0;
    const url = 'mongodb://127.0.0.1:27017';
    const dbname = 'shopping';
    const options = {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        directConnection: true
    };

    const connectWithRetry = async () => {
        try {
            // Close existing connection if any
            if (state.client) {
                await state.client.close();
                state.client = null;
                state.db = null;
            }

            // Create new connection
            const client = new MongoClient(url, options);
            await client.connect();

            // Test the connection
            await client.db(dbname).command({ ping: 1 });

            // Store references
            state.client = client;
            state.db = client.db(dbname);

            // Setup connection event handlers
            client.on('close', () => {
                state.db = null;
                state.client = null;
            });

            client.on('error', () => {
                state.db = null;
                state.client = null;
            });

            client.on('timeout', () => {
                state.db = null;
                state.client = null;
            });

            // Initialize collections
            try {
                const collections = await state.db.listCollections().toArray();
                const requiredCollections = [collection.USER_COLLECTION, collection.PRODUCT_COLLECTION, collection.CART_COLLECTION];

                for (const collName of requiredCollections) {
                    if (!collections.some(col => col.name === collName)) {
                        await state.db.createCollection(collName);
                    }
                }
            } catch (initError) {
                throw initError;
            }

            console.log('MongoDB connection and initialization successful');
            return true;
        } catch (err) {
            return false;
        }
    };

    while (retryCount < maxRetries) {
        const connected = await connectWithRetry();
        if (connected) return;

        retryCount++;
        if (retryCount < maxRetries) {
            const delay = 2000 * retryCount; // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    const error = new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
    console.error(error);
    throw error;
}

module.exports.get = function () {
    return state.db
}