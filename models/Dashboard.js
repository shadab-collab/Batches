const mongoose = require("mongoose");

/* =====================================================
   MONTHLY SNAPSHOT
   One row per calendar month (yearMonth = "YYYY-MM").

   activeStudentCount / totalMonthlyFeeCommitted: written by
   the app itself, refreshed every time the Dashboard is
   opened DURING that month — so the current month always
   stays up to date, but once the month ends, whatever was
   last recorded stays frozen forever (Expell etc. afterward
   never touches it).

   manualCollection: only used for old months that predate
   this system, entered by hand through the Dashboard's
   "पुराना Data डालें" form. For any month where real Payment
   records exist, collection is computed live from them
   instead — manualCollection is just a fallback.
===================================================== */
const monthlySnapshotSchema = new mongoose.Schema({

  yearMonth: { type: String, unique: true, required: true },

  activeStudentCount: { type: Number, default: null },
  totalMonthlyFeeCommitted: { type: Number, default: null },

  manualCollection: { type: Number, default: null },
  manualAdmissionCollection: { type: Number, default: null },

  source: { type: String, enum: ["auto", "manual"], default: "auto" }

}, { timestamps: true });

const MonthlySnapshot = mongoose.model("MonthlySnapshot", monthlySnapshotSchema);

module.exports = { MonthlySnapshot };
