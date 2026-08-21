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