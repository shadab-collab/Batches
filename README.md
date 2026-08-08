# Batch Manager — MongoDB Edition

## Render Web Service

Build Command:
npm install

Start Command:
npm start

## Required Environment Variable

Add this in Render:

MONGODB_URI = your MongoDB Atlas connection string

## Important

The application stores the complete 10-batch structure in MongoDB.
Student add, delete, move, and ordering changes are saved through
/api/batches.

The browser localStorage remains as a temporary fallback/cache.
