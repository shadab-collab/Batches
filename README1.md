# Batch Manager — MongoDB + Safe Migration

## Render

Build Command:
npm install

Start Command:
npm start

Environment Variable:
MONGODB_URI = your MongoDB Atlas connection string

## First deployment / migration

The browser's existing `localStorage` data is preserved.

When the new app opens:
1. It asks the server for MongoDB batch data.
2. If MongoDB is empty, it takes the current browser's saved batch data and uploads it to MongoDB.
3. If MongoDB already contains data, MongoDB is used as the source of truth.

Do NOT clear browser site data before opening the new version if you need to migrate the current changes.

After successful migration, all future Add / Delete / Move / Position / Time changes are saved to MongoDB.
