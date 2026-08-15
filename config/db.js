const mongoose = require("mongoose");
let mongoReady = false;
/* =====================================================
   MONGODB CONNECTION
===================================================== */
async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    return;
  }
  try {
    await mongoose.connect(uri);
    mongoReady = true;
    console.log("MongoDB connected.");
  } catch (error) {
    mongoReady = false;
    console.error("MongoDB connection failed:", error.message);
  }
}
function isMongoReady() {
  return mongoReady;
}
module.exports = {
  connectMongo,
  isMongoReady
};