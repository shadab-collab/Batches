const express = require("express");
const router = express.Router();

const { MonthlySnapshot } = require("../models/Dashboard");
const { MonthlyAdjustment, AdjustmentLog, ADJUSTABLE_FIELDS } = require("../models/DashboardAdjustment");
const { FeeProfile, Payment } = require("../models/Fee");
const { isMongoReady } = require("../config/db");
const FeeUtils = require("../public/js/10-fee-utils.js");


function requireMongo(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).json({ success: false, message: "MongoDB is not connected" });
  }
  next();
}
router.use(requireMongo);


/* Sum of real payments (never charity) with paymentDate in [fromIso, toIso] */
async function tuitionCollectionInRange(fromIso, toIso) {
  const payments = await Payment.find({
    type: "payment",
    paymentDate: { $gte: fromIso, $lte: toIso }
  }).lean();
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/* Sum of admission fees paid in [fromIso, toIso] — counted once per
   owner even though the same admissionFeeAmount/admissionFeePaidDate
   is copied across every FeeProfile version row for that owner. */
async function admissionCollectionInRange(fromIso, toIso) {
  const profiles = await FeeProfile.find({
    admissionFeePaid: true,
    admissionFeePaidDate: { $gte: fromIso, $lte: toIso }
  }).lean();

  const seenOwners = new Set();
  let total = 0;
  for (const p of profiles) {
    const key = `${ p.ownerType }:${ p.ownerKey }`;
    if (seenOwners.has(key)) {
      continue;
    }
    seenOwners.add(key);
    total += p.admissionFeeAmount || 0;
  }
  return total;
}

function monthRange(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const from = `${ yearMonth }-01`;
  const to = FeeUtils.toISODate(year, month, FeeUtils.daysInMonth(year, month));
  return { from, to };
}


/* =====================================================
   AUTO SNAPSHOT (called by the app whenever the Dashboard
   is opened, for the CURRENT month only)
   POST /api/dashboard/snapshot
   Body: { yearMonth, activeStudentCount, totalMonthlyFeeCommitted }
===================================================== */
router.post("/snapshot", async (req, res) => {
  const { yearMonth, activeStudentCount, totalMonthlyFeeCommitted } = req.body;

  if (!yearMonth) {
    return res.status(400).json({ success: false, message: "yearMonth जरूरी है" });
  }

  try {
    const existing = await MonthlySnapshot.findOne({ yearMonth });
    if (existing && existing.source === "manual") {
      // never let an auto-refresh overwrite a manually entered historical month
      return res.json({ success: true, skipped: true });
    }

    await MonthlySnapshot.findOneAndUpdate(
      { yearMonth },
      {
        $set: {
          yearMonth,
          activeStudentCount,
          totalMonthlyFeeCommitted,
          source: "auto"
        }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Snapshot Save नहीं हुआ" });
  }
});


/* =====================================================
   MANUAL / HISTORICAL ENTRY (this IS the Original data for
   months before this system existed — editable/deletable,
   but always distinct from the Adjustment layer below)
   POST /api/dashboard/manual-entry
   Body: { yearMonth, activeStudentCount, collection, admissionCollection }
===================================================== */
router.post("/manual-entry", async (req, res) => {
  const { yearMonth, activeStudentCount, collection, admissionCollection } = req.body;

  if (!yearMonth) {
    return res.status(400).json({ success: false, message: "yearMonth जरूरी है" });
  }

  const realCurrentMonth = FeeUtils.todayISO().slice(0, 7);
  if (yearMonth >= realCurrentMonth) {
    return res.status(400).json({
      success: false,
      message: "यह Current या भविष्य का महीना है — इसका Data System खुद track करता है, हाथ से नहीं भरा जा सकता। पुराने महीनों के लिए ही इस्तेमाल करें।"
    });
  }

  try {
    await MonthlySnapshot.findOneAndUpdate(
      { yearMonth },
      {
        $set: {
          yearMonth,
          activeStudentCount: activeStudentCount || 0,
          manualCollection: collection || 0,
          manualAdmissionCollection: admissionCollection || 0,
          source: "manual"
        }
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Save नहीं हुआ" });
  }
});


/* =====================================================
   DELETE A MANUAL / HISTORICAL ENTRY
   POST /api/dashboard/manual-entry/delete
   Body: { yearMonth }
   Refuses on "auto" months — those come from the app itself,
   not something the admin hand-entered.
===================================================== */
router.post("/manual-entry/delete", async (req, res) => {
  const { yearMonth } = req.body;
  if (!yearMonth) {
    return res.status(400).json({ success: false, message: "yearMonth जरूरी है" });
  }
  try {
    const existing = await MonthlySnapshot.findOne({ yearMonth });
    if (!existing) {
      return res.json({ success: true });
    }
    if (existing.source !== "manual") {
      return res.status(400).json({ success: false, message: "यह हाथ से डाला गया Data नहीं है, हटाया नहीं जा सकता" });
    }
    await MonthlySnapshot.deleteOne({ yearMonth });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Delete नहीं हो सका" });
  }
});


/* =====================================================
   SET / REPLACE AN ADJUSTMENT
   POST /api/dashboard/adjustment
   Body: { yearMonth, field, value, reason }
   Replaces — never adds to — any earlier adjustment on the
   same month+field. Original data is never touched.
===================================================== */
router.post("/adjustment", async (req, res) => {
  const { yearMonth, field, value, reason } = req.body;

  if (!yearMonth || !ADJUSTABLE_FIELDS.includes(field)) {
    return res.status(400).json({ success: false, message: "yearMonth और मान्य field जरूरी हैं" });
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return res.status(400).json({ success: false, message: "value एक नंबर होना चाहिए" });
  }

  try {
    await MonthlyAdjustment.findOneAndUpdate(
      { yearMonth },
      { $set: { yearMonth, [field]: { value, reason: reason || "" } } },
      { upsert: true }
    );
    await AdjustmentLog.create({ yearMonth, field, action: "set", value, reason: reason || "" });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Adjustment Save नहीं हुआ" });
  }
});


/* =====================================================
   REMOVE AN ADJUSTMENT (Final goes back to Original)
   POST /api/dashboard/adjustment/remove
   Body: { yearMonth, field }
===================================================== */
router.post("/adjustment/remove", async (req, res) => {
  const { yearMonth, field } = req.body;

  if (!yearMonth || !ADJUSTABLE_FIELDS.includes(field)) {
    return res.status(400).json({ success: false, message: "yearMonth और मान्य field जरूरी हैं" });
  }

  try {
    await MonthlyAdjustment.findOneAndUpdate(
      { yearMonth },
      { $set: { yearMonth, [field]: { value: null, reason: "" } } },
      { upsert: true }
    );
    await AdjustmentLog.create({ yearMonth, field, action: "remove", value: null, reason: "" });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Remove नहीं हो सका" });
  }
});


/* =====================================================
   ADJUSTMENT AUDIT HISTORY FOR ONE MONTH
   GET /api/dashboard/adjustment-history?month=YYYY-MM
===================================================== */
router.get("/adjustment-history", async (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ success: false, message: "month जरूरी है" });
  }
  try {
    const logs = await AdjustmentLog.find({ yearMonth: month }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* Applies an adjustment (if any) on top of an Original value.
   Final = Original + Adjustment. No adjustment -> Final = Original. */
function applyAdjustment(original, adjustmentDoc) {
  const hasAdjustment = !!(adjustmentDoc && typeof adjustmentDoc.value === "number");
  const base = original === null || original === undefined ? 0 : original;
  const adj = hasAdjustment ? adjustmentDoc.value : 0;
  return {
    original,
    adjustment: hasAdjustment ? adjustmentDoc.value : null,
    reason: hasAdjustment ? adjustmentDoc.reason : "",
    final: base + adj,
    adjusted: hasAdjustment
  };
}

/* =====================================================
   SUMMARY FOR ONE MONTH
   GET /api/dashboard/summary?month=YYYY-MM
   Returns Original / Adjustment / Final for every adjustable
   field. Growth, comparisons etc. should always read `.final`.
===================================================== */
router.get("/summary", async (req, res) => {
  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ success: false, message: "month जरूरी है" });
  }

  try {
    const { from, to } = monthRange(month);

    const snapshot = await MonthlySnapshot.findOne({ yearMonth: month }).lean();
    const adjustment = await MonthlyAdjustment.findOne({ yearMonth: month }).lean();

    const tuitionLive = await tuitionCollectionInRange(from, to);
    const admissionLive = await admissionCollectionInRange(from, to);
    const hasLiveData = tuitionLive > 0 || admissionLive > 0;

    const originalActiveStudents = snapshot ? snapshot.activeStudentCount : null;
    const originalTotalMonthlyFee = snapshot ? snapshot.totalMonthlyFeeCommitted : null;
    const originalTuition = hasLiveData ? tuitionLive : (snapshot ? (snapshot.manualCollection || 0) : 0);
    const originalAdmission = hasLiveData ? admissionLive : (snapshot ? (snapshot.manualAdmissionCollection || 0) : 0);

    const activeStudents = applyAdjustment(originalActiveStudents, adjustment && adjustment.activeStudents);
    const totalMonthlyFee = applyAdjustment(originalTotalMonthlyFee, adjustment && adjustment.totalMonthlyFee);
    const tuitionCollection = applyAdjustment(originalTuition, adjustment && adjustment.tuitionCollection);
    const admissionCollection = applyAdjustment(originalAdmission, adjustment && adjustment.admissionCollection);

    res.json({
      success: true,
      yearMonth: month,
      source: snapshot ? snapshot.source : "auto",
      activeStudents,
      totalMonthlyFee,
      tuitionCollection,
      admissionCollection,
      totalCollection: {
        original: originalTuition + originalAdmission,
        final: tuitionCollection.final + admissionCollection.final
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* =====================================================
   UNIFIED GROWTH TIMELINE
   GET /api/dashboard/timeline
   Every month that has EITHER an Original snapshot/manual
   entry OR an Adjustment, sorted chronologically, with Final
   values — historical and automatic months side by side on
   one continuous timeline.
===================================================== */
router.get("/timeline", async (req, res) => {
  try {
    const snapshots = await MonthlySnapshot.find({}).lean();
    const adjustments = await MonthlyAdjustment.find({}).lean();

    const adjustmentByMonth = {};
    for (const a of adjustments) {
      adjustmentByMonth[a.yearMonth] = a;
    }

    const months = new Set([
      ...snapshots.map(s => s.yearMonth),
      ...adjustments.map(a => a.yearMonth)
    ]);

    const timeline = [];
    for (const yearMonth of months) {
      const snapshot = snapshots.find(s => s.yearMonth === yearMonth);
      const adjustment = adjustmentByMonth[yearMonth];

      const originalActiveStudents = snapshot ? snapshot.activeStudentCount : null;

      let originalTuition;
      let originalAdmission;
      if (snapshot && snapshot.source === "manual") {
        originalTuition = snapshot.manualCollection || 0;
        originalAdmission = snapshot.manualAdmissionCollection || 0;
      } else {
        const { from, to } = monthRange(yearMonth);
        originalTuition = await tuitionCollectionInRange(from, to);
        originalAdmission = await admissionCollectionInRange(from, to);
      }

      const activeStudents = applyAdjustment(originalActiveStudents, adjustment && adjustment.activeStudents);
      const totalCollectionFinal =
        applyAdjustment(originalTuition, adjustment && adjustment.tuitionCollection).final +
        applyAdjustment(originalAdmission, adjustment && adjustment.admissionCollection).final;

      timeline.push({
        yearMonth,
        activeStudentsFinal: activeStudents.final,
        totalCollectionFinal,
        source: snapshot ? snapshot.source : "auto",
        adjusted: !!adjustment
      });
    }

    timeline.sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));

    res.json({ success: true, timeline });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* =====================================================
   DAILY / WEEKLY BREAKDOWN
   GET /api/dashboard/range?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week
===================================================== */
router.get("/range", async (req, res) => {
  const { from, to, groupBy } = req.query;

  if (!from || !to) {
    return res.status(400).json({ success: false, message: "from और to जरूरी हैं" });
  }

  try {
    const payments = await Payment.find({
      type: "payment",
      paymentDate: { $gte: from, $lte: to }
    }).lean();

    const profiles = await FeeProfile.find({
      admissionFeePaid: true,
      admissionFeePaidDate: { $gte: from, $lte: to }
    }).lean();

    const seenOwners = new Set();
    const admissionEntries = [];
    for (const p of profiles) {
      const key = `${ p.ownerType }:${ p.ownerKey }`;
      if (seenOwners.has(key)) {
        continue;
      }
      seenOwners.add(key);
      admissionEntries.push({ date: p.admissionFeePaidDate, amount: p.admissionFeeAmount || 0 });
    }

    function bucketKey(dateIso) {
      if (groupBy === "week") {
        const d = FeeUtils.parseISODate(dateIso);
        // ISO-ish week bucket: group by the Monday-starting week number within the month, simple/approximate
        const weekNum = Math.ceil(d.day / 7);
        return `${ dateIso.slice(0, 7) } - सप्ताह ${ weekNum }`;
      }
      return dateIso;
    }

    const buckets = {};
    for (const p of payments) {
      const k = bucketKey(p.paymentDate);
      buckets[k] = (buckets[k] || 0) + p.amount;
    }
    for (const a of admissionEntries) {
      const k = bucketKey(a.date);
      buckets[k] = (buckets[k] || 0) + a.amount;
    }

    const result = Object.keys(buckets).sort().map(key => ({ bucket: key, amount: buckets[key] }));

    res.json({ success: true, buckets: result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


module.exports = router;
