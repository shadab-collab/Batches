const mongoose = require("mongoose");

/* =====================================================
   FORMATIVE ASSESSMENT
   One document per student — a continuously-updated rolling
   card, not a permanent history log. Each section holds at
   most 6 entries, newest first; adding a 7th drops the oldest.
===================================================== */
const assessmentSchema = new mongoose.Schema({

  studentId: { type: String, unique: true, required: true },

  studentClass: { type: String, default: "" },
  period: { type: String, default: "" }, // "मूल्यांकन अवधि" — freeform text
  teacherComment: { type: String, default: "" },

  improvementEntries: { type: [String], default: [] }, // "सुधार", newest first, max 6
  gapEntries: { type: [String], default: [] } // "कमी", newest first, max 6

}, { timestamps: true });

const Assessment = mongoose.model("Assessment", assessmentSchema);

module.exports = { Assessment };
