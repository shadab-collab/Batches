const express = require("express");
const router = express.Router();

const { Receipt, getNextReceiptNo } = require("../models/Receipt");
const { isMongoReady } = require("../config/db");


function requireMongo(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).json({ success: false, message: "MongoDB is not connected" });
  }
  next();
}
router.use(requireMongo);


/* =====================================================
   CREATE RECEIPT  POST /api/receipts
   Always creates a brand new row with the next receipt
   number — never updates an existing one.
===================================================== */
router.post("/", async (req, res) => {
  const {
    ownerType, ownerKey, cycleKey, date,
    studentName, fatherName, address, board, studentClass, monthText,
    admissionFee, tuitionFee, othersCharges, total, totalInWords, note
  } = req.body;

  if (!ownerType || !ownerKey || !date || typeof total !== "number") {
    return res.status(400).json({ success: false, message: "ownerType, ownerKey, date और total जरूरी हैं" });
  }

  try {
    const receiptNo = await getNextReceiptNo();

    const receipt = await Receipt.create({
      receiptNo,
      ownerType,
      ownerKey,
      cycleKey: cycleKey || "",
      date,
      studentName: studentName || "",
      fatherName: fatherName || "",
      address: address || "",
      board: board || "",
      studentClass: studentClass || "",
      monthText: monthText || "",
      admissionFee: admissionFee || 0,
      tuitionFee: tuitionFee || 0,
      othersCharges: othersCharges || 0,
      total,
      totalInWords: totalInWords || "",
      note: note || ""
    });

    res.json({ success: true, receipt });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Receipt Save नहीं हुई" });
  }
});


/* =====================================================
   LIST RECEIPTS FOR AN OWNER
   GET /api/receipts/owner/:ownerType/:ownerKey
   (defined before /:receiptNo so it isn't shadowed)
===================================================== */
router.get("/owner/:ownerType/:ownerKey", async (req, res) => {
  const { ownerType, ownerKey } = req.params;

  try {
    const receipts = await Receipt.find({ ownerType, ownerKey })
      .sort({ receiptNo: -1 })
      .lean();
    res.json({ success: true, receipts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* =====================================================
   LOOKUP BY RECEIPT NUMBER  GET /api/receipts/:receiptNo
===================================================== */
router.get("/:receiptNo", async (req, res) => {
  const receiptNo = Number(req.params.receiptNo);

  if (!receiptNo) {
    return res.status(400).json({ success: false, message: "Receipt No. सही नहीं है" });
  }

  try {
    const receipt = await Receipt.findOne({ receiptNo }).lean();
    if (!receipt) {
      return res.status(404).json({ success: false, message: "यह Receipt No. नहीं मिला" });
    }
    res.json({ success: true, receipt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


module.exports = router;
