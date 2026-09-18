const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { FeeProfile, FeeCycle, Payment } = require("../models/Fee");
const { BatchData } = require("../models/BatchData");
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
   Body: { feeMode, amount, memberFees, dueDateType, joiningDate,
           applyFrom: "next" (default) | "current" }
   "next"    — old behaviour: current/past cycles keep their old
               amount, only cycles from next month onward change.
   "current" — the change applies from THIS running cycle onward;
               if that cycle's FeeCycle row already exists (locked
               at the old amount), it is refreshed to the new
               amount too. Meant for family membership changes
               (a member leaving/joining mid-cycle) where the
               owner needs the CURRENT cycle's total corrected,
               not just future ones.
===================================================== */
router.post("/:ownerType/:ownerKey/profile", async (req, res) => {
  const { ownerType, ownerKey } = req.params;
  const { feeMode, amount, memberFees, dueDateType, joiningDate, pushFirstCycle, admissionFeeAmount, admissionFeePaid, applyFrom } = req.body;

  if (!["fixed", "individual", "total"].includes(feeMode)) {
    return res.status(400).json({ success: false, message: "Invalid feeMode" });
  }
  if (![1, 15].includes(dueDateType)) {
    return res.status(400).json({ success: false, message: "dueDateType must be 1 or 15" });
  }

  try {
    const existing = await FeeProfile.find({ ownerType, ownerKey }).sort({ effectiveFrom: 1 });

    let effectiveFrom;
    let currentCycleKeyForRefresh = null;

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

      if (applyFrom === "current") {
        // इसी चल रहे cycle से नया amount लागू — पिछला profile उससे
        // पिछली cycle तक ही सीमित रह जाता है।
        effectiveFrom = currentCycle.cycleKey;
        currentCycleKeyForRefresh = currentCycle.cycleKey;
        const prev = FeeUtils.prevMonth(
          FeeUtils.parseISODate(currentCycle.cycleKey).year,
          FeeUtils.parseISODate(currentCycle.cycleKey).month
        );
        const prevCycleKey = FeeUtils.cycleForMonth(dueDateType, prev.year, prev.month).cycleKey;
        if (active) {
          await FeeProfile.updateOne({ _id: active._id }, { $set: { effectiveTo: prevCycleKey } });
        }
      } else {
        const afterCurrent = FeeUtils.nextMonth(
          FeeUtils.parseISODate(currentCycle.cycleKey).year,
          FeeUtils.parseISODate(currentCycle.cycleKey).month
        );
        const nextCycleObj = FeeUtils.cycleForMonth(dueDateType, afterCurrent.year, afterCurrent.month);
        effectiveFrom = nextCycleObj.cycleKey;
        if (active) {
          await FeeProfile.updateOne({ _id: active._id }, { $set: { effectiveTo: currentCycle.cycleKey } });
        }
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

    // "current" चुना गया था और उस cycle का FeeCycle row पहले से बन चुका था
    // (पुराने amount पर locked) — तो उसे भी नए amount पर refresh करें, वरना
    // change इसी चल रहे cycle में दिखेगा ही नहीं।
    if (currentCycleKeyForRefresh) {
      await FeeCycle.updateOne(
        { ownerType, ownerKey, cycleKey: currentCycleKeyForRefresh },
        { $set: { amountDue: amountForProfile(created) } }
      );
    }

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
    // Advance payments can target a cycle that hasn't come due yet, so it
    // may not exist as a FeeCycle row — create it now (locked from the
    // currently active profile) so the payment shows up immediately
    // instead of staying invisible until the cycle's due date arrives.
    const profiles = await FeeProfile.find({ ownerType, ownerKey }).sort({ effectiveFrom: 1 });
    if (profiles.length) {
      const dueDateType = profiles[0].dueDateType;
      for (const a of allocations) {
        const existing = await FeeCycle.findOne({ ownerType, ownerKey, cycleKey: a.cycleKey });
        if (!existing) {
          const profile = profileForCycle(profiles, a.cycleKey);
          if (profile) {
            const parsed = FeeUtils.parseISODate(a.cycleKey);
            const cycle = FeeUtils.cycleForMonth(dueDateType, parsed.year, parsed.month);
            await FeeCycle.findOneAndUpdate(
              { ownerType, ownerKey, cycleKey: a.cycleKey },
              {
                $setOnInsert: {
                  ownerType,
                  ownerKey,
                  cycleKey: cycle.cycleKey,
                  dueDate: cycle.dueDate,
                  cycleStart: cycle.cycleStart,
                  cycleEnd: cycle.cycleEnd,
                  amountDue: amountForProfile(profile)
                }
              },
              { upsert: true }
            );
          }
        }
      }
    }

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
   EDIT / DELETE A SINGLE PAYMENT OR CHARITY ENTRY
   For genuine correction of a mistaken entry — this directly
   fixes/removes the row that was wrong.
===================================================== */
router.post("/:ownerType/:ownerKey/payment/:paymentId/edit", async (req, res) => {
  const { ownerType, ownerKey, paymentId } = req.params;
  const { amount, paymentDate, note } = req.body;

  if (typeof amount !== "number" || amount <= 0 || !paymentDate) {
    return res.status(400).json({ success: false, message: "Amount और Date जरूरी हैं" });
  }

  try {
    const result = await Payment.updateOne(
      { _id: paymentId, ownerType, ownerKey },
      { $set: { amount, paymentDate, note: note || "" } }
    );
    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: "यह Entry नहीं मिली" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Update नहीं हो सका" });
  }
});

router.post("/:ownerType/:ownerKey/payment/:paymentId/delete", async (req, res) => {
  const { ownerType, ownerKey, paymentId } = req.params;

  try {
    await Payment.deleteOne({ _id: paymentId, ownerType, ownerKey });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Delete नहीं हो सका" });
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


const MONTH_CODES = ["JN", "FB", "MR", "AP", "MY", "JU", "JL", "AU", "SP", "OC", "NV", "DC"];
function monthAbbrev(cycleKey) {
  return MONTH_CODES[Number(cycleKey.split("-")[1]) - 1];
}

function pendingMonthCodes(dueDateType, joiningIso, profiles, paidByCycle, todayIso) {
  const firstCycle = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningIso);
  const currentCycle = FeeUtils.getCurrentCycle(dueDateType, todayIso);
  if (FeeUtils.compareISODate(firstCycle.cycleKey, currentCycle.cycleKey) > 0) {
    return [];
  }
  const cycleKeys = FeeUtils.listCycles(dueDateType, firstCycle.cycleKey, currentCycle.cycleKey).map(c => c.cycleKey);
  const codes = [];
  for (const key of cycleKeys) {
    const profile = profileForCycle(profiles, key);
    if (!profile) {
      continue;
    }
    const due = amountForProfile(profile);
    const paid = paidByCycle[key] || 0;
    if (paid < due) {
      codes.push(monthAbbrev(key));
    }
  }
  return codes;
}


/* =====================================================
   MONTHLY WALL LIST
   GET /api/fees/monthly-list
   Groups every currently active student by their fee due
   date (1st or 15th), keeping family members adjacent, with
   each owner's pending months auto-computed from real Fee
   data — built to directly replace a hand-maintained paper
   list, so it needs zero manual re-encoding each month.
===================================================== */
router.get("/monthly-list", async (req, res) => {
  try {
    const batchData = await BatchData.findOne({ key: "main" }).lean();
    const allStudents = [];
    ((batchData && batchData.batches) || []).forEach(b => allStudents.push(...(b.students || [])));

    const ownersMap = new Map();
    allStudents.forEach(s => {
      // Solo Free students have no fee to collect at all — skip them
      // entirely from the collection list. (A Free child inside a
      // Family still shows, since the family unit may still owe for
      // its other members.)
      if (!s.familyCode && s.feeFree) {
        return;
      }
      const ownerType = s.familyCode ? "family" : "student";
      const ownerKey = s.familyCode || s.id;
      if (!ownersMap.has(ownerKey)) {
        ownersMap.set(ownerKey, { ownerType, ownerKey, members: [] });
      }
      ownersMap.get(ownerKey).members.push({ id: s.id, name: s.name, identity: s.identity || "", listCodeName: s.listCodeName || "" });
    });

    const allProfiles = await FeeProfile.find({}).sort({ effectiveFrom: 1 }).lean();
    const allPayments = await Payment.find({}).lean();

    const profilesByOwner = {};
    allProfiles.forEach(p => {
      const key = `${ p.ownerType }:${ p.ownerKey }`;
      if (!profilesByOwner[key]) {
        profilesByOwner[key] = [];
      }
      profilesByOwner[key].push(p);
    });

    const paidByOwnerCycle = {};
    allPayments.forEach(pay => {
      const key = `${ pay.ownerType }:${ pay.ownerKey }`;
      if (!paidByOwnerCycle[key]) {
        paidByOwnerCycle[key] = {};
      }
      paidByOwnerCycle[key][pay.cycleKey] = (paidByOwnerCycle[key][pay.cycleKey] || 0) + pay.amount;
    });

    const today = FeeUtils.todayISO();
    const due01 = [];
    const due15 = [];
    const noProfile = [];

    for (const owner of ownersMap.values()) {
      const key = `${ owner.ownerType }:${ owner.ownerKey }`;
      const ownerProfiles = profilesByOwner[key] || [];

      if (!ownerProfiles.length) {
        noProfile.push(owner);
        continue;
      }

      const dueDateType = ownerProfiles[0].dueDateType;
      const joiningIso = ownerProfiles[0].joiningDate || ownerProfiles[0].effectiveFrom;
      const codes = pendingMonthCodes(dueDateType, joiningIso, ownerProfiles, paidByOwnerCycle[key] || {}, today);

      const entry = { ...owner, monthCodes: codes };
      if (dueDateType === 1) {
        due01.push(entry);
      } else {
        due15.push(entry);
      }
    }

    // Alphabetical order: sort each family's own members first, then sort
    // every owner (solo student or whole family) by its first member's name
    // — so a family always sits together, in the right alphabetical spot.
    function displayName(member) {
      return (member.listCodeName && member.listCodeName.trim()) ? member.listCodeName : member.name;
    }
    function sortOwnersAlphabetically(list) {
      list.forEach(owner => {
        owner.members.sort((a, b) => displayName(a).localeCompare(displayName(b), "hi"));
      });
      list.sort((a, b) => displayName(a.members[0]).localeCompare(displayName(b.members[0]), "hi"));
    }
    sortOwnersAlphabetically(due01);
    sortOwnersAlphabetically(due15);
    sortOwnersAlphabetically(noProfile);

    res.json({ success: true, due01, due15, noProfile });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Load नहीं हो सका" });
  }
});


module.exports = router;
