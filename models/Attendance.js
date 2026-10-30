const mongoose = require("mongoose");

/* =====================================================
   ATTENDANCE
   एक row = एक student की एक दिन की "Present" मार्किंग।
   Absent के लिए कोई row नहीं बनती — किसी दिन कोई row ना हो और वो दिन
   Holiday भी ना हो, तो उसे Absent माना जाता है (Attendance History में
   हर गुज़रे गैर-Holiday दिन को गिनकर पता चलता है)।
   {studentId, date} हमेशा unique रहता है, ताकि एक दिन में Count सिर्फ
   एक बार ही बढ़े — दुबारा Right-swipe करने पर कुछ नहीं होता।
===================================================== */
const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  // जिस Batch में था उस दिन — बाद में Batch बदल भी जाए तो भी पुराना
  // record सही Batch के हिसाब से ही गिना रहे।
  batchId: {
    type: String,
    default: ""
  },
  date: {
    type: String,
    required: true
  }
}, { timestamps: true });

attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = { Attendance };
