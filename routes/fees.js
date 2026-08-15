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
   cycle up to the current due cycle. Never overwrites an existing row's
   amountDue (that stays locked once created). */
async function ensureCycles(ownerType, ownerKey, profiles) {
  const dueDateType = profiles[0].dueDateType;
  const joiningIso = profiles[0].joiningDate || profiles[0].effectiveFrom;

  const firstCycle = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningIso);
  const currentCycle = FeeUtils.getCurrentCycle(dueDateType, FeeUtils.todayISO());
  const allCycles = FeeUtils.listCycles(dueDateType, firstCycle.cycleKey, currentCycle.cycleKey);

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

  try {
    const profiles = await FeeProfile.find({ ownerType, ownerKey })
      .sort({ effectiveFrom: 1 })
      .lean();

    if (!profiles.length) {
      return res.json({ success: true, hasProfile: false });
    }

    await ensureCycles(ownerType, ownerKey, profiles);

    const cycles = await FeeCycle.find({ ownerType, ownerKey })
      .sort({ cycleKey: 1 })
      .lean();

    const payments = await Payment.find({ ownerType, ownerKey })
      .sort({ paymentDate: 1, createdAt: 1 })
      .lean();

    const paidByCycle = {};
    for (const p of payments) {
      paidByCycle[p.cycleKey] = (paidByCycle[p.cycleKey] || 0) + p.amount;
    }

    let totalDue = 0;
    const cycleSummaries = cycles.map(c => {
      const paidSum = paidByCycle[c.cycleKey] || 0;
      const remaining = c.amountDue - paidSum;
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
        remaining,
        status: FeeUtils.computeCycleStatus(c.amountDue, paidSum)
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
  const { feeMode, amount, memberFees, dueDateType, joiningDate } = req.body;

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
      effectiveFrom = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningDate).cycleKey;
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


module.exports = router;
