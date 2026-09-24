const express = require("express");
const router = express.Router();

const { BatchData } = require("../models/BatchData");
const { FeeProfile, FeeCycle, Payment } = require("../models/Fee");
const { isMongoReady } = require("../config/db");
const FeeUtils = require("../public/js/10-fee-utils.js");
const { profileForCycle, amountForProfile } = require("./fees");

function requireMongo(req, res, next) {
  if (!isMongoReady()) {
    return res.status(503).send("MongoDB is not connected");
  }
  next();
}
router.use(requireMongo);

/* =====================================================
   READ-ONLY FEE STATE (for Backup only)
   Same numbers as the normal Fee card, but computed WITHOUT
   writing anything to the database — a live Cycle row's
   locked amount is used where one already exists, and any
   cycle that has never been opened yet (no row created) is
   computed on the fly from the Fee Profile instead. This
   matters here because Backup may look at every owner in the
   whole app in one go — writing/upserting a Cycle row for
   every single one of those (like the normal Fee-card flow
   does) would mean hundreds of extra database round trips and
   make the export very slow. Reading only keeps it fast.
===================================================== */
async function computeReadOnlyFeeState(ownerType, ownerKey) {
  const profiles = await FeeProfile.find({ ownerType, ownerKey }).sort({ effectiveFrom: 1 }).lean();
  if (!profiles.length) {
    return { hasProfile: false };
  }

  const dueDateType = profiles[0].dueDateType;
  const joiningIso = profiles[0].joiningDate || profiles[0].effectiveFrom;
  const firstCycle = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningIso);
  const lastCycle = FeeUtils.getCurrentCycle(dueDateType, FeeUtils.todayISO());

  let expectedCycles = [];
  if (FeeUtils.compareISODate(firstCycle.cycleKey, lastCycle.cycleKey) <= 0) {
    expectedCycles = FeeUtils.listCycles(dueDateType, firstCycle.cycleKey, lastCycle.cycleKey);
  }

  const [existingCycles, payments] = await Promise.all([
    FeeCycle.find({ ownerType, ownerKey }).lean(),
    Payment.find({ ownerType, ownerKey }).sort({ paymentDate: 1, createdAt: 1 }).lean()
  ]);
  const existingByKey = new Map(existingCycles.map(c => [c.cycleKey, c]));

  const paidByCycle = {};
  const charityByCycle = {};
  const lastDateByCycle = {};
  for (const p of payments) {
    const isCharity = p.type === "charity";
    const bucket = isCharity ? charityByCycle : paidByCycle;
    bucket[p.cycleKey] = (bucket[p.cycleKey] || 0) + p.amount;
    if (!lastDateByCycle[p.cycleKey] || p.paymentDate > lastDateByCycle[p.cycleKey]) {
      lastDateByCycle[p.cycleKey] = p.paymentDate;
    }
  }

  let totalDue = 0;
  const cycles = expectedCycles.map(c => {
    const existing = existingByKey.get(c.cycleKey);
    let amountDue;
    if (existing) {
      amountDue = existing.amountDue;
    } else {
      const profile = profileForCycle(profiles, c.cycleKey);
      amountDue = profile ? amountForProfile(profile) : 0;
    }
    const paidSum = paidByCycle[c.cycleKey] || 0;
    const charitySum = charityByCycle[c.cycleKey] || 0;
    const remaining = amountDue - paidSum - charitySum;
    if (remaining > 0) {
      totalDue += remaining;
    }
    return {
      cycleKey: c.cycleKey,
      dueDate: c.dueDate,
      cycleStart: c.cycleStart,
      cycleEnd: c.cycleEnd,
      amountDue,
      paidSum,
      charitySum,
      remaining,
      lastDate: lastDateByCycle[c.cycleKey] || null,
      status: FeeUtils.computeCycleStatus(amountDue, paidSum, charitySum)
    };
  });

  return { hasProfile: true, cycles, payments, totalDue };
}

function esc(s) {
  return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));
}

const STATUS_CLASS = {
  "Paid": "st-paid",
  "Partial": "st-partial",
  "Unpaid": "st-unpaid"
};

function cycleTableHtml(cycles) {
  if (!cycles.length) {
    return `<div class="empty-note">कोई Cycle नहीं बना।</div>`;
  }
  const rows = cycles.slice().reverse().map(c => `
        <tr>
            <td>${ esc(FeeUtils.formatCycleRange(c)) }</td>
            <td>₹${ c.amountDue }</td>
            <td>₹${ c.paidSum }</td>
            <td>${ c.charitySum > 0 ? "₹" + c.charitySum : "-" }</td>
            <td>₹${ c.remaining }</td>
            <td class="${ STATUS_CLASS[c.status] || "" }">${ esc(c.status) }</td>
            <td>${ c.lastDate ? esc(FeeUtils.formatDDMM(c.lastDate)) : "-" }</td>
        </tr>
    `).join("");
  return `
        <table class="fee-table">
            <thead>
                <tr>
                    <th>Cycle</th><th>Due</th><th>Paid</th><th>Charity</th><th>Remaining</th><th>Status</th><th>आखिरी Date</th>
                </tr>
            </thead>
            <tbody>${ rows }</tbody>
        </table>
    `;
}

router.get("/export-html", async (req, res) => {
  try {
    const data = await BatchData.findOne({ key: "main" }).lean();
    const batches = (data && data.batches) || [];
    const inactiveStudents = (data && data.inactiveStudents) || [];

    // Collect every owner key (current + historical) that any
    // included student touches, and who currently/formerly used it.
    const owners = new Map();
    function touch(ownerType, ownerKey, name, isCurrent) {
      const k = ownerType + ":" + ownerKey;
      if (!owners.has(k)) {
        owners.set(k, { ownerType, ownerKey, currentMembers: [], formerMembers: [] });
      }
      const entry = owners.get(k);
      if (isCurrent) {
        entry.currentMembers.push(name);
      } else if (!entry.formerMembers.includes(name)) {
        entry.formerMembers.push(name);
      }
    }

    const studentRows = []; // for the batch-wise listing

    function processStudent(student, batchLabel, statusLabel) {
      if (student.expelled) {
        return; // excluded from Backup by choice
      }
      const ownerType = student.familyCode ? "family" : "student";
      const ownerKey = student.familyCode || student.id;
      touch(ownerType, ownerKey, student.name, true);
      (student.feeHistoryKeys || []).forEach(hk => {
        if (!(hk.ownerType === ownerType && hk.ownerKey === ownerKey)) {
          touch(hk.ownerType, hk.ownerKey, student.name, false);
        }
      });
      studentRows.push({
        name: student.name,
        identity: student.identity || "",
        batchLabel,
        admissionDate: student.admissionDate || "",
        familyCode: student.familyCode || "",
        status: statusLabel,
        feeFree: !!student.feeFree,
        ownerType,
        ownerKey
      });
    }

    batches.forEach(batch => {
      (batch.students || []).forEach(student => {
        processStudent(student, batch.name, student.away ? "Temporarily Away" : "Active");
      });
    });
    inactiveStudents.forEach(student => {
      const since = student.inactiveSince ? ` (${ FeeUtils.formatDDMM(student.inactiveSince) } से)` : "";
      processStudent(student, "— Inactive —", "Inactive" + since);
    });

    // Fetch fee state for every owner key found — in parallel, since
    // these are all plain reads now — and roll up a month-wise
    // collection summary across all of them together.
    const ownerEntries = Array.from(owners.entries());
    const states = await Promise.all(
      ownerEntries.map(([, info]) => computeReadOnlyFeeState(info.ownerType, info.ownerKey))
    );
    const feeStateByKey = new Map();
    const monthlyTotals = new Map(); // cycleKey -> {due, paid, charity}

    ownerEntries.forEach(([k], idx) => {
      const state = states[idx];
      feeStateByKey.set(k, state);
      if (state.hasProfile) {
        state.cycles.forEach(c => {
          if (!monthlyTotals.has(c.cycleKey)) {
            monthlyTotals.set(c.cycleKey, { cycleKey: c.cycleKey, cycle: c, due: 0, paid: 0, charity: 0 });
          }
          const m = monthlyTotals.get(c.cycleKey);
          m.due += c.amountDue;
          m.paid += c.paidSum;
          m.charity += c.charitySum;
        });
      }
    });

    // ---------- Section 1: Batch-wise student/family fee detail ----------
    const batchGroups = new Map();
    studentRows.forEach(row => {
      if (!batchGroups.has(row.batchLabel)) {
        batchGroups.set(row.batchLabel, []);
      }
      batchGroups.get(row.batchLabel).push(row);
    });

    const renderedOwnerKeys = new Set(); // a family's block prints once, not once per member

    let batchSectionsHtml = "";
    for (const [batchLabel, rows] of batchGroups.entries()) {
      batchSectionsHtml += `<h2 class="batch-heading">${ esc(batchLabel) }</h2>`;

      for (const row of rows) {
        const ownerK = row.ownerType + ":" + row.ownerKey;
        if (renderedOwnerKeys.has(ownerK) && row.ownerType === "family") {
          continue; // already printed this family's block under an earlier member
        }
        renderedOwnerKeys.add(ownerK);

        const ownerInfo = owners.get(ownerK);
        const membersLabel = row.ownerType === "family"
          ? `Family (Code: ${ esc(row.ownerKey) }) — ${ esc(ownerInfo.currentMembers.join(", ")) }`
          : `${ esc(row.name) }${ row.identity ? ` (${ esc(row.identity) })` : "" }`;

        const admissionLine = row.ownerType === "family"
          ? rows.filter(r => r.ownerKey === row.ownerKey).map(r => `${ esc(r.name) }: ${ r.admissionDate ? esc(r.admissionDate) : "—" }`).join(" · ")
          : (row.admissionDate ? esc(row.admissionDate) : "—");

        batchSectionsHtml += `
                    <div class="owner-block">
                        <div class="owner-title">${ membersLabel } <span class="status-tag">${ esc(row.status) }</span>${ row.feeFree ? ` <span class="free-tag">🆓 Free</span>` : "" }</div>
                        <div class="owner-sub">Admission Date: ${ admissionLine }</div>
                        ${ row.feeFree ? `<div class="empty-note">🆓 Free Student — कोई Fee Track नहीं हो रहा।</div>` : "" }
                `;

        if (!row.feeFree) {
          const state = feeStateByKey.get(ownerK);
          if (!state || !state.hasProfile) {
            batchSectionsHtml += `<div class="empty-note">अभी तक कोई Fee Set नहीं है।</div>`;
          } else {
            batchSectionsHtml += cycleTableHtml(state.cycles);
          }
        }

        batchSectionsHtml += `</div>`;
      }
    }

    // Historical/shared owner keys that are no longer anyone's CURRENT
    // key at all (e.g. an old solo id after merging into a family that
    // still exists) — print them once more here so nothing is missed.
    let sharedHistoryHtml = "";
    for (const [k, info] of owners.entries()) {
      if (info.currentMembers.length) {
        continue; // already printed above under its current owner
      }
      const state = feeStateByKey.get(k);
      if (!state || !state.hasProfile) {
        continue;
      }
      const label = info.ownerType === "family"
        ? `पुराना Family Record (Code: ${ esc(info.ownerKey) }) — पहले साथ थे: ${ esc(info.formerMembers.join(", ")) }`
        : `पुराना Individual Record — ${ esc(info.formerMembers.join(", ")) }`;
      sharedHistoryHtml += `
                <div class="owner-block">
                    <div class="owner-title">🔗 ${ label }</div>
                    ${ cycleTableHtml(state.cycles) }
                </div>
            `;
    }

    // ---------- Section 2: Monthly collection summary ----------
    const sortedMonths = Array.from(monthlyTotals.values()).sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));
    const monthlyRows = sortedMonths.map(m => `
            <tr>
                <td>${ esc(FeeUtils.formatCycleRange(m.cycle)) }</td>
                <td>₹${ m.due }</td>
                <td>₹${ m.paid }</td>
                <td>${ m.charity > 0 ? "₹" + m.charity : "-" }</td>
                <td>₹${ m.due - m.paid - m.charity }</td>
            </tr>
        `).join("");

    const generatedOn = FeeUtils.formatDDMM(FeeUtils.todayISO()) + " " + new Date().getFullYear();

    const html = `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<title>Backup — ${ esc(generatedOn) }</title>
<style>
    body{font-family:Arial,"Noto Sans Devanagari",sans-serif;margin:24px;color:#222;}
    h1{font-size:20px;margin-bottom:4px;}
    .generated{color:#666;font-size:12px;margin-bottom:24px;}
    h2.section-heading{font-size:17px;margin-top:36px;border-bottom:2px solid #333;padding-bottom:4px;}
    h2.batch-heading{font-size:15px;margin-top:26px;background:#eef1f5;padding:6px 10px;border-radius:6px;}
    .owner-block{margin:14px 0;padding:10px 12px;border:1px solid #ddd;border-radius:8px;page-break-inside:avoid;}
    .owner-title{font-weight:bold;font-size:13.5px;margin-bottom:4px;}
    .owner-sub{font-size:12px;color:#555;margin-bottom:8px;}
    .status-tag{font-weight:normal;font-size:11px;background:#333;color:#fff;padding:1px 8px;border-radius:10px;margin-left:6px;}
    .free-tag{font-size:11px;background:#e8f5e9;color:#2e7d32;padding:1px 8px;border-radius:10px;margin-left:6px;}
    table.fee-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px;}
    table.fee-table th, table.fee-table td{border:1px solid #ddd;padding:4px 6px;text-align:left;}
    table.fee-table th{background:#f7f7f7;}
    .st-paid{color:#2e7d32;font-weight:bold;}
    .st-partial{color:#e65100;font-weight:bold;}
    .st-unpaid{color:#c62828;font-weight:bold;}
    .empty-note{font-size:12px;color:#888;font-style:italic;}
    .print-btn-wrap{position:sticky;top:0;background:#fff;padding:10px 0;margin-bottom:10px;border-bottom:1px solid #ddd;z-index:5;}
    .print-btn{background:#2e7d32;color:#fff;border:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:bold;}
    @media print{ body{margin:8mm;} .owner-block{border-color:#999;} .no-print{display:none !important;} }
</style>
</head>
<body>

    <div class="print-btn-wrap no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <div style="font-size:12px;color:#666;margin-top:6px;">इस बटन को दबाएं → खुलने वाले Print विकल्प में "Save as PDF" या "PDF" चुनें।</div>
    </div>

    <h1>Batches — पूरा Backup</h1>
    <div class="generated">Generated on: ${ esc(generatedOn) } — यह Record खास कर Fee के लिए है; किसी site crash की स्थिति में इसी से manually फिर से डेटा भरा जा सकता है।</div>

    <h2 class="section-heading">1. Batch-wise Student/Family Fee Record</h2>
    ${ batchSectionsHtml || `<div class="empty-note">कोई Batch/Student नहीं मिला।</div>` }

    ${ sharedHistoryHtml ? `<h2 class="section-heading">2. पुराने Records (अब किसी की Current Key नहीं)</h2>${ sharedHistoryHtml }` : "" }

    <h2 class="section-heading">${ sharedHistoryHtml ? "3" : "2" }. Monthly Collection Summary</h2>
    <table class="fee-table">
        <thead><tr><th>Cycle</th><th>कुल Due</th><th>कुल Paid</th><th>Charity</th><th>कुल Pending</th></tr></thead>
        <tbody>${ monthlyRows || `<tr><td colspan="5" class="empty-note">कोई Cycle नहीं मिला।</td></tr>` }</tbody>
    </table>

</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);

  } catch (error) {
    console.error(error);
    res.status(500).send("Backup नहीं बन सका। दोबारा कोशिश करें।");
  }
});

module.exports = router;
