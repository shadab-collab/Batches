const mongoose = require("mongoose");

/* =====================================================
   FEE PROFILE
   One row per "version" of a student/family's fee setup.
   Never edited in place — a change (amount, mode, or family
   membership) closes the old row (effectiveTo) and inserts
   a new one (effectiveFrom the next cycle). This is what
   keeps past cycle amounts locked even after fees change.
===================================================== */
const feeProfileSchema = new mongoose.Schema({

  ownerType: { type: String, enum: ["student", "family"], required: true },
  ownerKey: { type: String, required: true }, // student.id or familyCode

  feeMode: { type: String, enum: ["fixed", "individual", "total"], required: true },
  // fixed      -> solo student, uses `amount`
  // total      -> family combined fee, uses `amount`
  // individual -> family per-child fees, uses `memberFees`

  amount: { type: Number, default: 0 },
  memberFees: {
    type: [{ studentId: String, amount: Number, _id: false }],
    default: []
  },

  dueDateType: { type: Number, enum: [1, 15], required: true },
  joiningDate: { type: String }, // ISO date, only meaningful on the first profile row

  // one-time admission fee, only meaningful on the first profile row —
  // separate from the monthly cycle system entirely
  admissionFeeAmount: { type: Number, default: 0 },
  admissionFeePaid: { type: Boolean, default: false },

  effectiveFrom: { type: String, required: true }, // cycleKey (ISO date) this version starts applying from
  effectiveTo: { type: String, default: null } // cycleKey it stopped applying at, null = still active

}, { timestamps: true });

feeProfileSchema.index({ ownerType: 1, ownerKey: 1, effectiveFrom: 1 });


/* =====================================================
   FEE CYCLE
   One row per billing cycle that has actually come due.
   amountDue is locked in at creation time from whichever
   FeeProfile version was active on that cycle's due date.
===================================================== */
const feeCycleSchema = new mongoose.Schema({

  ownerType: { type: String, enum: ["student", "family"], required: true },
  ownerKey: { type: String, required: true },

  cycleKey: { type: String, required: true }, // ISO due date, e.g. "2026-08-01"
  dueDate: { type: String, required: true },
  cycleStart: { type: String, required: true },
  cycleEnd: { type: String, required: true },

  amountDue: { type: Number, required: true }

}, { timestamps: true });

feeCycleSchema.index({ ownerType: 1, ownerKey: 1, cycleKey: 1 }, { unique: true });


/* =====================================================
   PAYMENT
   One row per cycle-allocation. A single real-world payment
   that covers more than one cycle becomes multiple rows
   sharing the same transactionId, so they still display as
   one payment while each cycle's own history stays accurate.
   Rows are only ever added, never edited or deleted.
===================================================== */
const paymentSchema = new mongoose.Schema({

  ownerType: { type: String, enum: ["student", "family"], required: true },
  ownerKey: { type: String, required: true },
  cycleKey: { type: String, required: true },

  amount: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  note: { type: String, default: "" },
  transactionId: { type: String, required: true }

}, { timestamps: true });

paymentSchema.index({ ownerType: 1, ownerKey: 1, cycleKey: 1 });


const FeeProfile = mongoose.model("FeeProfile", feeProfileSchema);
const FeeCycle = mongoose.model("FeeCycle", feeCycleSchema);
const Payment = mongoose.model("Payment", paymentSchema);

module.exports = { FeeProfile, FeeCycle, Payment };
