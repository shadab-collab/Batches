const mongoose = require("mongoose");

const ADJUSTABLE_FIELDS = ["activeStudents", "totalMonthlyFee", "tuitionCollection", "admissionCollection"];

/* =====================================================
   MONTHLY ADJUSTMENT (current state)
   One document per month. Each field's adjustment is either
   a number (currently applied, REPLACING any earlier value —
   never cumulative) or null (no adjustment, Final = Original).
===================================================== */
const fieldAdjustmentSchema = new mongoose.Schema({
  value: { type: Number, default: null },
  reason: { type: String, default: "" }
}, { _id: false });

const monthlyAdjustmentSchema = new mongoose.Schema({
  yearMonth: { type: String, unique: true, required: true },
  activeStudents: { type: fieldAdjustmentSchema, default: () => ({}) },
  totalMonthlyFee: { type: fieldAdjustmentSchema, default: () => ({}) },
  tuitionCollection: { type: fieldAdjustmentSchema, default: () => ({}) },
  admissionCollection: { type: fieldAdjustmentSchema, default: () => ({}) }
}, { timestamps: true });

const MonthlyAdjustment = mongoose.model("MonthlyAdjustment", monthlyAdjustmentSchema);


/* =====================================================
   ADJUSTMENT LOG (audit trail)
   Append-only — every set/replace/remove is recorded here
   permanently, even though the "current" adjustment above
   can change. This is history, not the Original data itself.
===================================================== */
const adjustmentLogSchema = new mongoose.Schema({
  yearMonth: { type: String, required: true },
  field: { type: String, enum: ADJUSTABLE_FIELDS, required: true },
  action: { type: String, enum: ["set", "remove"], required: true },
  value: { type: Number, default: null },
  reason: { type: String, default: "" }
}, { timestamps: true });

const AdjustmentLog = mongoose.model("AdjustmentLog", adjustmentLogSchema);


module.exports = { MonthlyAdjustment, AdjustmentLog, ADJUSTABLE_FIELDS };
