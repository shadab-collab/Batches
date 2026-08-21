const mongoose = require("mongoose");

/* =====================================================
   HOLIDAY (full-day, applies to every batch)
===================================================== */
const holidaySchema = new mongoose.Schema({
  date: { type: String, unique: true, required: true },
  note: { type: String, default: "" }
}, { timestamps: true });

const Holiday = mongoose.model("Holiday", holidaySchema);


/* =====================================================
   ATTENDANCE RECORD
   Sparse by design — a row here means "Absent". No row for
   a given student+date means Auto Present (the default).
   Marking someone present again simply deletes their row.
===================================================== */
const attendanceRecordSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  date: { type: String, required: true }
}, { timestamps: true });

attendanceRecordSchema.index({ studentId: 1, date: 1 }, { unique: true });

const AttendanceRecord = mongoose.model("AttendanceRecord", attendanceRecordSchema);


module.exports = { Holiday, AttendanceRecord };
