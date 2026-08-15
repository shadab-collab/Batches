const mongoose = require("mongoose");

/* =====================================================
   COUNTER
   Generic auto-increment helper. The receipt counter is
   seeded at 2100 (the coaching center's own numbering
   before this system existed) so the first receipt this
   system creates is 2101.
===================================================== */
const counterSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  value: { type: Number, required: true }
});

const Counter = mongoose.model("Counter", counterSchema);

async function getNextReceiptNo() {
  // make sure the counter exists, seeded at 2100 — a no-op if it already exists
  await Counter.findOneAndUpdate(
    { name: "receipt" },
    { $setOnInsert: { name: "receipt", value: 2100 } },
    { upsert: true }
  );
  // always increments by exactly 1, atomically, and returns the new value
  const updated = await Counter.findOneAndUpdate(
    { name: "receipt" },
    { $inc: { value: 1 } },
    { new: true }
  );
  return updated.value;
}


/* =====================================================
   RECEIPT
   One row per generated receipt. Rows are only ever
   created, never updated or deleted — a receiptNo is
   permanent once issued.
===================================================== */
const receiptSchema = new mongoose.Schema({

  receiptNo: { type: Number, unique: true, required: true },

  ownerType: { type: String, enum: ["student", "family"], required: true },
  ownerKey: { type: String, required: true },
  cycleKey: { type: String, default: "" }, // which fee cycle this receipt is for, if any

  date: { type: String, required: true }, // ISO date shown on the receipt (actual payment date)

  studentName: { type: String, default: "" },
  fatherName: { type: String, default: "" },
  address: { type: String, default: "" },
  board: { type: String, default: "" },
  studentClass: { type: String, default: "" },
  monthText: { type: String, default: "" }, // e.g. "01 अगस्त तक Clear"

  admissionFee: { type: Number, default: 0 },
  tuitionFee: { type: Number, default: 0 },
  othersCharges: { type: Number, default: 0 },
  total: { type: Number, required: true },
  totalInWords: { type: String, default: "" },
  note: { type: String, default: "" }

}, { timestamps: true });

const Receipt = mongoose.model("Receipt", receiptSchema);

module.exports = { Receipt, getNextReceiptNo };
