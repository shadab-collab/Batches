const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  value: { type: Number, required: true }
});

const Counter = mongoose.model("Counter", counterSchema);

/* Ensures the named counter exists (seeded if needed), then atomically
   increments it by 1 and returns the new value. */
async function getNextCounterValue(name, seedValue) {
  await Counter.findOneAndUpdate(
    { name },
    { $setOnInsert: { name, value: seedValue } },
    { upsert: true }
  );
  const updated = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { new: true }
  );
  return updated.value;
}

module.exports = { Counter, getNextCounterValue };
