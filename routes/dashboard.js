const express = require("express");
const router = express.Router();

const { MonthlySnapshot } = require("../models/Dashboard");
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
   MANUAL / HISTORICAL ENTRY
   POST /api/dashboard/manual-entry
   Body: { yearMonth, activeStudentCount, collection, admissionCollection }
===================================================== */
router.post("/manual-entry", async (req, res) => {
  const { yearMonth, activeStudentCount, collection, admissionCollection } = req.body;

  if (!yearMonth) {
    return res.status(400).json({ success: false, message: "yearMonth जरूरी है" });
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
   SUMMARY FOR ONE MONTH
   GET /api/dashboard/summary?month=YYYY-MM
===================================================== */
router.get("/summary", async (req, res) => {
  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ success: false, message: "month जरूरी है" });
  }

  try {
    const { from, to } = monthRange(month);

    const snapshot = await MonthlySnapshot.findOne({ yearMonth: month }).lean();

    const tuition = await tuitionCollectionInRange(from, to);
    const admission = await admissionCollectionInRange(from, to);
    const hasLiveData = tuition > 0 || admission > 0;

    const collection = hasLiveData
      ? tuition + admission
      : (snapshot ? (snapshot.manualCollection || 0) + (snapshot.manualAdmissionCollection || 0) : 0);

    res.json({
      success: true,
      yearMonth: month,
      activeStudentCount: snapshot ? snapshot.activeStudentCount : null,
      totalMonthlyFeeCommitted: snapshot ? snapshot.totalMonthlyFeeCommitted : null,
      collection,
      tuitionCollection: hasLiveData ? tuition : (snapshot ? (snapshot.manualCollection || 0) : 0),
      admissionCollection: hasLiveData ? admission : (snapshot ? (snapshot.manualAdmissionCollection || 0) : 0),
      source: snapshot ? snapshot.source : "auto"
    });

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
