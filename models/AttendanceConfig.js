const mongoose = require("mongoose");

/* =====================================================
   ATTENDANCE CONFIG — छुट्टियों की सेटिंग
   जानबूझकर Batch वाले main document (BatchData) में नहीं रखा गया —
   Attendance पेज अलग tab में खुलता है, और अगर यह सेटिंग Batches के साथ
   रहती तो मुख्य app के किसी भी Save से बिना बताए मिट सकती थी।

   weekly   : हर Batch की साप्ताहिक छुट्टी  [{ batchId, day }]   (0 = रविवार ... 6 = शनिवार)
   holidays : त्योहार की छुट्टियां, सभी Batch पर एक साथ  [{ date, label }]
===================================================== */
const weeklySchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  day: { type: Number, required: true, min: 0, max: 6 }
}, { _id: false });

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true },
  label: { type: String, default: "" }
}, { _id: false });

const attendanceConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  weekly: { type: [weeklySchema], default: [] },
  holidays: { type: [holidaySchema], default: [] }
}, { timestamps: true });

const AttendanceConfig = mongoose.model("AttendanceConfig", attendanceConfigSchema);

module.exports = { AttendanceConfig };
