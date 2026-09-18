const mongoose = require("mongoose");
/* =====================================================
   STUDENT
===================================================== */
const studentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  familyCode: {
    type: String,
    default: ""
  },
  admissionDate: {
    type: String,
    default: ""
  },
  // Every {ownerType, ownerKey} the student has ever been billed under —
  // their own solo id, and every family code they've ever been part of.
  // Nothing is ever removed from this list, so old fee history always
  // stays reachable even after family membership changes.
  feeHistoryKeys: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  active: {
    type: Boolean,
    default: true
  },
  inactiveSince: {
    type: String,
    default: ""
  },
  expelled: {
    type: Boolean,
    default: false
  },
  identity: {
    type: String,
    default: ""
  },
  listCodeName: {
    type: String,
    default: ""
  },
  batchId: {
    type: String,
    default: ""
  }
}, { _id: false });
/* =====================================================
   BATCH
===================================================== */
const batchSchema = new mongoose.Schema({
  id: {
    type: String,
    default: ""
  },
  name: {
    type: String,
    required: true
  },
  time: {
    type: String,
    default: ""
  },
  weeklyHolidays: {
    type: [Number],
    default: []
  },
  students: {
    type: [studentSchema],
    default: []
  }
}, { _id: false });
/* =====================================================
   BATCH DATA
===================================================== */
const batchDataSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    required: true
  },
  batches: {
    type: [batchSchema],
    default: []
  },
  inactiveStudents: {
    type: [studentSchema],
    default: []
  }
}, { timestamps: true });
const BatchData = mongoose.model("BatchData", batchDataSchema);
module.exports = {
  BatchData,
  studentSchema,
  batchSchema
};