const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { FeeProfile, FeeCycle, Payment } = require("../models/Fee");
const { isMongoReady } = require("../config/db");
const FeeUtils = require("../public/js/10-fee-utils.js");


function requireMongo(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).json({ success: false, message: "MongoDB is not connected" });
  }
  next();
}
router.use(requireMongo);


/* Find the FeeProfile version that applied to a given cycleKey */
function profileForCycle(profiles, cycleKey) {
  return profiles.find(p =>
    FeeUtils.compareISODate(p.effectiveFrom, cycleKey) <= 0 &&
    (p.effectiveTo === null || FeeUtils.compareISODate(cycleKey, p.effectiveTo) <= 0)
  );
}

function amountForProfile(profile) {
  if (profile.feeMode === "individual") {
    return profile.memberFees.reduce((sum, m) => sum + (m.amount || 0), 0);
  }
  return profile.amount || 0;
}

/* Make sure a FeeCycle row exists for every cycle from the owner's first
   cycle up to the current due cycle (or, if capDate is given — e.g. the
   date a solo student went inactive — up to the last cycle that date
   actually falls within). Never overwrites an existing row's amountDue
   (that stays locked once created). */
async function ensureCycles(ownerType, ownerKey, profiles, capDate) {
  const dueDateType = profiles[0].dueDateType;
  const joiningIso = profiles[0].joiningDate || profiles[0].effectiveFrom;

  const firstCycle = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningIso);
  let lastCycle = FeeUtils.getCurrentCycle(dueDateType, FeeUtils.todayISO());

  if (capDate) {
    const capCycle = FeeUtils.getCycleContaining(dueDateType, capDate);
    if (FeeUtils.compareISODate(capCycle.cycleKey, lastCycle.cycleKey) < 0) {
      lastCycle = capCycle;
    }
  }

  if (FeeUtils.compareISODate(firstCycle.cycleKey, lastCycle.cycleKey) > 0) {
    return [];
  }

  const allCycles = FeeUtils.listCycles(dueDateType, firstCycle.cycleKey, lastCycle.cycleKey);

  for (const c of allCycles) {
    const profile = profileForCycle(profiles, c.cycleKey);
    if (!profile) {
      continue;
    }
    await FeeCycle.findOneAndUpdate(
      { ownerType, ownerKey, cycleKey: c.cycleKey },
      {
        $setOnInsert: {
          ownerType,
          ownerKey,
          cycleKey: c.cycleKey,
          dueDate: c.dueDate,
          cycleStart: c.cycleStart,
          cycleEnd: c.cycleEnd,
          amountDue: amountForProfile(profile)
        }
      },
      { upsert: true }
    );
  }

  return allCycles.map(c => c.cycleKey);
}


/* =====================================================
   GET FEE STATE  /api/fees/:ownerType/:ownerKey
===================================================== */
router.get("/:ownerType/:ownerKey", async (req, res) => {
  const { ownerType, ownerKey } = req.params;
  const { capDate } = req.query;

  try {
    const profiles = await FeeProfile.find({ ownerType, ownerKey })
      .sort({ effectiveFrom: 1 })
      .lean();

    if (!profiles.length) {
      return res.json({ success: true, hasProfile: false });
    }

    await ensureCycles(ownerType, ownerKey, profiles, capDate);

    const cycles = await FeeCycle.find({ ownerType, ownerKey })
      .sort({ cycleKey: 1 })
      .lean();

    const payments = await Payment.find({ ownerType, ownerKey })
      .sort({ paymentDate: 1, createdAt: 1 })
      .lean();

    const paidByCycle = {};
    const charityByCycle = {};
    const lastDateByCycle = {};
    for (const p of payments) {
      const isCharity = p.type === "charity";
      const bucket = isCharity ? charityByCycle : paidByCycle;
      bucket[p.cycleKey] = (bucket[p.cycleKey] || 0) + p.amount;
      // track the latest date touching this cycle, payment or charity alike
      if (!lastDateByCycle[p.cycleKey] || p.paymentDate > lastDateByCycle[p.cycleKey]) {
        lastDateByCycle[p.cycleKey] = p.paymentDate;
      }
    }

    let totalDue = 0;
    const cycleSummaries = cycles.map(c => {
      const paidSum = paidByCycle[c.cycleKey] || 0;
      const charitySum = charityByCycle[c.cycleKey] || 0;
      const remaining = c.amountDue - paidSum - charitySum;
      if (remaining > 0) {
        totalDue += remaining;
      }
      return {
        cycleKey: c.cycleKey,
        dueDate: c.dueDate,
        cycleStart: c.cycleStart,
        cycleEnd: c.cycleEnd,
        amountDue: c.amountDue,
        paidSum,
        charitySum,
        remaining,
        lastDate: lastDateByCycle[c.cycleKey] || null,
        status: FeeUtils.computeCycleStatus(c.amountDue, paidSum, charitySum)
      };
    });

    const activeProfile = profiles.find(p => p.effectiveTo === null) || profiles[profiles.length - 1];

    res.json({
      success: true,
      hasProfile: true,
      activeProfile,
      profileHistory: profiles,
      cycles: cycleSummaries,
      payments,
      totalDue
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not load fee data" });
  }
});


/* =====================================================
   SET / UPDATE FEE PROFILE  /api/fees/:ownerType/:ownerKey/profile
   Body: { feeMode, amount, memberFees, dueDateType, joiningDate }
   A change always takes effect from the NEXT due cycle onward —
   the current and all past cycles keep whatever amount they were
   already locked to.
===================================================== */
router.post("/:ownerType/:ownerKey/profile", async (req, res) => {
  const { ownerType, ownerKey } = req.params;
  const { feeMode, amount, memberFees, dueDateType, joiningDate, pushFirstCycle, admissionFeeAmount, admissionFeePaid } = req.body;

  if (!["fixed", "individual", "total"].includes(feeMode)) {
    return res.status(400).json({ success: false, message: "Invalid feeMode" });
  }
  if (![1, 15].includes(dueDateType)) {
    return res.status(400).json({ success: false, message: "dueDateType must be 1 or 15" });
  }

  try {
    const existing = await FeeProfile.find({ ownerType, ownerKey }).sort({ effectiveFrom: 1 });

    let effectiveFrom;

    if (!existing.length) {
      if (!joiningDate) {
        return res.status(400).json({ success: false, message: "joiningDate is required for a new profile" });
      }
      let firstCycle = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningDate);
      // admin can push the first billed cycle one step further out —
      // used when the student joined too close to the auto-picked due
      // date to fairly bill from it (e.g. joined a few days before it)
      if (pushFirstCycle) {
        const after = FeeUtils.nextMonth(
          FeeUtils.parseISODate(firstCycle.cycleKey).year,
          FeeUtils.parseISODate(firstCycle.cycleKey).month
        );
        firstCycle = FeeUtils.cycleForMonth(dueDateType, after.year, after.month);
      }
      effectiveFrom = firstCycle.cycleKey;
    } else {
      const active = existing.find(p => p.effectiveTo === null);
      const currentCycle = FeeUtils.getCurrentCycle(dueDateType, FeeUtils.todayISO());
      const afterCurrent = FeeUtils.nextMonth(
        FeeUtils.parseISODate(currentCycle.cycleKey).year,
        FeeUtils.parseISODate(currentCycle.cycleKey).month
      );
      const nextCycleObj = FeeUtils.cycleForMonth(dueDateType, afterCurrent.year, afterCurrent.month);
      effectiveFrom = nextCycleObj.cycleKey;

      if (active) {
        active.effectiveTo = currentCycle.cycleKey;
        await FeeProfile.updateOne({ _id: active._id }, { $set: { effectiveTo: currentCycle.cycleKey } });
      }
    }

    const created = await FeeProfile.create({
      ownerType,
      ownerKey,
      feeMode,
      amount: amount || 0,
      memberFees: Array.isArray(memberFees) ? memberFees : [],
      dueDateType,
      joiningDate: existing.length ? existing[0].joiningDate : joiningDate,
      admissionFeeAmount: existing.length ? existing[0].admissionFeeAmount : (admissionFeeAmount || 0),
      admissionFeePaid: existing.length ? existing[0].admissionFeePaid : !!admissionFeePaid,
      effectiveFrom,
      effectiveTo: null
    });

    res.json({ success: true, profile: created });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not save fee profile" });
  }
});


/* =====================================================
   RECORD PAYMENT  /api/fees/:ownerType/:ownerKey/payment
   Body: { paymentDate, note, allocations: [{ cycleKey, amount }] }
   One real payment can be manually split across several cycles;
   all resulting rows share one transactionId.
===================================================== */
router.post("/:ownerType/:ownerKey/payment", async (req, res) => {
  const { ownerType, ownerKey } = req.params;
  const { paymentDate, note, allocations } = req.body;

  if (!paymentDate || !Array.isArray(allocations) || !allocations.length) {
    return res.status(400).json({ success: false, message: "paymentDate and allocations are required" });
  }
  for (const a of allocations) {
    if (!a.cycleKey || typeof a.amount !== "number" || a.amount <= 0) {
      return res.status(400).json({ success: false, message: "Each allocation needs a cycleKey and a positive amount" });
    }
  }

  try {
    const transactionId = crypto.randomBytes(8).toString("hex");

    const docs = allocations.map(a => ({
      ownerType,
      ownerKey,
      cycleKey: a.cycleKey,
      amount: a.amount,
      paymentDate,
      note: note || "",
      transactionId
    }));

    await Payment.insertMany(docs);

    res.json({ success: true, transactionId, count: docs.length });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Could not record payment" });
  }
});


/* =====================================================
   MARK ADMISSION FEE AS PAID
   /api/fees/:ownerType/:ownerKey/admission-fee-paid
   One-time metadata update — not a cycle amount, so it's
   fine to update in place (only touches the first profile row).
===================================================== */
router.post("/:ownerType/:ownerKey/admission-fee-paid", async (req, res) => {
  const { ownerType, ownerKey } = req.params;
  const paidDate = req.body.date || FeeUtils.todayISO();

  try {
    const first = await FeeProfile.findOne({ ownerType, ownerKey }).sort({ effectiveFrom: 1 });
    if (!first) {
      return res.status(404).json({ success: false, message: "Fee profile नहीं मिला" });
    }
    await FeeProfile.updateMany(
      { ownerType, ownerKey },
      { $set: { admissionFeePaid: true, admissionFeePaidDate: paidDate } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Update नहीं हुआ" });
  }
});


/* =====================================================
   RECORD CHARITY  /api/fees/:ownerType/:ownerKey/charity
   Body: { cycleKey, amount, date, note }
   A fee waiver for one specific cycle — stored the same way as
   a payment (immutable log row) but tagged type:"charity" so it
   never counts as money received, only as amount forgiven.
===================================================== */
router.post("/:ownerType/:ownerKey/charity", async (req, res) => {
  const { ownerType, ownerKey } = req.params;
  const { cycleKey, amount, date, note } = req.body;

  if (!cycleKey || typeof amount !== "number" || amount <= 0 || !date) {
    return res.status(400).json({ success: false, message: "cycleKey, amount और date जरूरी हैं" });
  }

  try {
    await Payment.create({
      ownerType,
      ownerKey,
      cycleKey,
      type: "charity",
      amount,
      paymentDate: date,
      note: note || "",
      transactionId: crypto.randomBytes(8).toString("hex")
    });

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Charity Save नहीं हुई" });
  }
});


/* =====================================================
   BULK STATUS (for colour-coding student names by recent
   payment history on the batch grid)
   POST /api/fees/bulk-status
   Body: { owners: [{ ownerType, ownerKey }, ...] }
   Read-only — never creates FeeCycle rows, just computes
   cycle keys on the fly from date math so it never depends
   on a profile having been opened before.
===================================================== */
router.post("/bulk-status", async (req, res) => {
  const { owners } = req.body;

  if (!Array.isArray(owners) || !owners.length) {
    return res.json({ success: true, statuses: {} });
  }

  const uniqueMap = new Map();
  for (const o of owners) {
    if (o && o.ownerType && o.ownerKey) {
      uniqueMap.set(`${ o.ownerType }:${ o.ownerKey }`, o);
    }
  }
  const uniqueOwners = Array.from(uniqueMap.values());

  try {
    const orConditions = uniqueOwners.map(o => ({ ownerType: o.ownerType, ownerKey: o.ownerKey }));

    const profiles = await FeeProfile.find({ $or: orConditions })
      .sort({ effectiveFrom: 1 })
      .lean();
    const paymentDocs = await Payment.find({ $or: orConditions }).lean();

    const profilesByOwner = {};
    for (const p of profiles) {
      const key = `${ p.ownerType }:${ p.ownerKey }`;
      if (!profilesByOwner[key]) {
        profilesByOwner[key] = [];
      }
      profilesByOwner[key].push(p);
    }

    // both a payment and a charity entry count as "settled" for this
    // visual indicator — charity is not the same as "didn't pay"
    const paidByOwnerCycle = {};
    for (const pay of paymentDocs) {
      const key = `${ pay.ownerType }:${ pay.ownerKey }`;
      if (!paidByOwnerCycle[key]) {
        paidByOwnerCycle[key] = {};
      }
      paidByOwnerCycle[key][pay.cycleKey] = (paidByOwnerCycle[key][pay.cycleKey] || 0) + pay.amount;
    }

    const today = FeeUtils.todayISO();
    const statuses = {};

    for (const o of uniqueOwners) {
      const key = `${ o.ownerType }:${ o.ownerKey }`;
      const ownerProfiles = profilesByOwner[key] || [];
      if (!ownerProfiles.length) {
        continue;
      }

      const dueDateType = ownerProfiles[0].dueDateType;
      const joiningIso = ownerProfiles[0].joiningDate || ownerProfiles[0].effectiveFrom;
      const firstCycle = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningIso);
      const currentCycle = FeeUtils.getCurrentCycle(dueDateType, today);

      if (FeeUtils.compareISODate(firstCycle.cycleKey, currentCycle.cycleKey) > 0) {
        continue;
      }

      const cycleKeys = FeeUtils.listCycles(dueDateType, firstCycle.cycleKey, currentCycle.cycleKey)
        .map(c => c.cycleKey);
      const paidMap = paidByOwnerCycle[key] || {};

      const currentProfile = profileForCycle(ownerProfiles, currentCycle.cycleKey);
      const amountDue = currentProfile ? amountForProfile(currentProfile) : 0;

      let index = cycleKeys.length - 1;
      const currentPaid = (paidMap[cycleKeys[index]] || 0) > 0;

      if (currentPaid) {
        statuses[key] = { status: "paid", amountDue };
        continue;
      }

      let streak = 0;
      while (index >= 0 && (paidMap[cycleKeys[index]] || 0) <= 0) {
        streak++;
        index--;
      }
      statuses[key] = { status: "unpaid", streak, amountDue };
    }

    res.json({ success: true, statuses });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* =====================================================
   FIND ORPHANED FEE DATA
   POST /api/fees/orphaned
   Body: { validOwners: [{ ownerType, ownerKey }, ...] }
   (the app sends every student/family it currently knows
   about — anything in the Fee data NOT in that list has no
   student behind it anymore, e.g. a deleted test student.)
===================================================== */
router.post("/orphaned", async (req, res) => {
  const { validOwners } = req.body;
  const validSet = new Set((validOwners || []).map(o => `${ o.ownerType }:${ o.ownerKey }`));

  try {
    const profiles = await FeeProfile.find({}).lean();
    const seen = new Map();
    for (const p of profiles) {
      const key = `${ p.ownerType }:${ p.ownerKey }`;
      if (!validSet.has(key) && !seen.has(key)) {
        seen.set(key, { ownerType: p.ownerType, ownerKey: p.ownerKey });
      }
    }

    const { Receipt } = require("../models/Receipt");
    const results = [];

    for (const { ownerType, ownerKey } of seen.values()) {
      const payments = await Payment.find({ ownerType, ownerKey }).lean();
      const totalPaid = payments.filter(p => p.type !== "charity").reduce((s, p) => s + p.amount, 0);
      const totalCharity = payments.filter(p => p.type === "charity").reduce((s, p) => s + p.amount, 0);
      const cycleCount = await FeeCycle.countDocuments({ ownerType, ownerKey });
      const lastPayment = payments.sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1))[0];
      const receipt = await Receipt.findOne({ ownerType, ownerKey }).lean();
      const receiptCount = await Receipt.countDocuments({ ownerType, ownerKey });

      results.push({
        ownerType,
        ownerKey,
        possibleName: receipt ? receipt.studentName : "",
        totalPaid,
        totalCharity,
        cycleCount,
        receiptCount,
        lastActivity: lastPayment ? lastPayment.paymentDate : null
      });
    }

    res.json({ success: true, orphaned: results });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


/* =====================================================
   PERMANENTLY DELETE AN OWNER'S FEE DATA
   POST /api/fees/purge-owner
   Body: { ownerType, ownerKey, purgeReceipts }
   Irreversible. Only meant for orphaned owners surfaced by
   /orphaned above (fake/test/mistakenly-deleted students).
===================================================== */
router.post("/purge-owner", async (req, res) => {
  const { ownerType, ownerKey, purgeReceipts } = req.body;

  if (!ownerType || !ownerKey) {
    return res.status(400).json({ success: false, message: "ownerType और ownerKey जरूरी हैं" });
  }

  try {
    await FeeProfile.deleteMany({ ownerType, ownerKey });
    await FeeCycle.deleteMany({ ownerType, ownerKey });
    await Payment.deleteMany({ ownerType, ownerKey });

    let receiptsDeleted = 0;
    if (purgeReceipts) {
      const { Receipt } = require("../models/Receipt");
      const result = await Receipt.deleteMany({ ownerType, ownerKey });
      receiptsDeleted = result.deletedCount || 0;
    }

    res.json({ success: true, receiptsDeleted });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Delete नहीं हो सका" });
  }
});


module.exports = router;
