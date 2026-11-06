const mongoose = require("mongoose");

/* =====================================================
   ATTENDANCE CONFIG — छुट्टियों की सेटिंग
   जानबूझकर Batch वाले main document (BatchData) में नहीं रखा गया —
   Attendance पेज अलग tab में खुलता है, और अगर यह सेटिंग Batches के साथ
   रहती तो मुख्य app के किसी भी Save से बिना बताए मिट सकती थी।

   weekly   : हर Batch की साप्ताहिक छुट्टी  [{ batchId, day }]   (0 = रविवार ... 6 = शनिवार)
   holidays : तारीख वाली छुट्टियां (त्योहार या कोई भी खास दिन) — हर तारीख की एक entry,
              सभी Batch के लिए या सिर्फ चुने हुए Batch के लिए  [{ date, label, batchIds }]
===================================================== */
const weeklySchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  day: { type: Number, required: true, min: 0, max: 6 }
}, { _id: false });

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true },
  label: { type: String, default: "" },
  // खाली = सभी Batch की छुट्टी; वरना सिर्फ इन Batch की (batchKey की list)
  batchIds: { type: [String], default: [] }
}, { _id: false });

const attendanceConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  weekly: { type: [weeklySchema], default: [] },
  holidays: { type: [holidaySchema], default: [] }
}, { timestamps: true });

const AttendanceConfig = mongoose.model("AttendanceConfig", attendanceConfigSchema);

module.exports = { AttendanceConfig };
