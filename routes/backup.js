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

/* =====================================================
   GATHER EVERYTHING BACKUP NEEDS, ONCE
   Shared by both the HTML export (for Print/Save-as-PDF) and
   the direct PDF download below — same data, two renderers.
===================================================== */
async function buildBackupDataset() {
  const data = await BatchData.findOne({ key: "main" }).lean();
  const batches = (data && data.batches) || [];
  const inactiveStudents = (data && data.inactiveStudents) || [];
  const awayStudents = (data && data.awayStudents) || [];

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

  const studentRows = [];

  function processStudent(student, batchLabel, statusLabel) {
    if (student.expelled) {
      return;
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
      processStudent(student, batch.name, "Active");
    });
  });
  awayStudents.forEach(student => {
    const since = student.awaySince ? ` (${ FeeUtils.formatDDMM(student.awaySince) } से)` : "";
    processStudent(student, student.awayBatchName || "— Temporarily Away —", "Temporarily Away" + since);
  });
  inactiveStudents.forEach(student => {
    const since = student.inactiveSince ? ` (${ FeeUtils.formatDDMM(student.inactiveSince) } से)` : "";
    processStudent(student, "— Inactive —", "Inactive" + since);
  });

  const ownerEntries = Array.from(owners.entries());
  const states = await Promise.all(
    ownerEntries.map(([, info]) => computeReadOnlyFeeState(info.ownerType, info.ownerKey))
  );
  const feeStateByKey = new Map();
  const monthlyTotals = new Map();

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

  const batchGroups = new Map();
  studentRows.forEach(row => {
    if (!batchGroups.has(row.batchLabel)) {
      batchGroups.set(row.batchLabel, []);
    }
    batchGroups.get(row.batchLabel).push(row);
  });

  const sortedMonths = Array.from(monthlyTotals.values()).sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));

  return { owners, feeStateByKey, batchGroups, sortedMonths };
}

router.get("/export-html", async (req, res) => {
  try {
    const { owners, feeStateByKey, batchGroups, sortedMonths } = await buildBackupDataset();

    const renderedOwnerKeys = new Set();

    let batchSectionsHtml = "";
    for (const [batchLabel, rows] of batchGroups.entries()) {
      batchSectionsHtml += `<h2 class="batch-heading">${ esc(batchLabel) }</h2>`;

      for (const row of rows) {
        const ownerK = row.ownerType + ":" + row.ownerKey;
        if (renderedOwnerKeys.has(ownerK) && row.ownerType === "family") {
          continue;
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

    let sharedHistoryHtml = "";
    for (const [k, info] of owners.entries()) {
      if (info.currentMembers.length) {
        continue;
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
    .print-btn-wrap{position:sticky;top:0;background:#fff;padding:10px 0;margin-bottom:10px;border-bottom:1px solid #ddd;z-index:5;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
    .print-btn{background:#2e7d32;color:#fff;border:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:bold;}
    .download-btn{background:#1565c0;color:#fff;border:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:bold;text-decoration:none;display:inline-block;}
    @media print{ body{margin:8mm;} .owner-block{border-color:#999;} .no-print{display:none !important;} }
</style>
</head>
<body>

    <div class="print-btn-wrap no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <a class="download-btn" href="/api/backup/export-pdf">⬇️ सीधे PDF Download करें</a>
    </div>
    <div class="generated no-print" style="margin-bottom:14px;">पहला बटन Print विकल्प खोलता है (उसमें "Save as PDF" चुनें); दूसरा बटन बिना कोई विकल्प खोले सीधे PDF file download कर देता है।</div>

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

/* =====================================================
   DIRECT PDF DOWNLOAD (no print dialog)
   Same data as /export-html, drawn as an actual PDF file with
   pdfkit and streamed straight to the browser as a download.
===================================================== */
router.get("/export-pdf", async (req, res) => {
  try {
    const path = require("path");
    const PDFDocument = require("pdfkit");
    const { owners, feeStateByKey, batchGroups, sortedMonths } = await buildBackupDataset();

    const generatedOn = FeeUtils.formatDDMM(FeeUtils.todayISO()) + " " + new Date().getFullYear();
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

    // Default pdfkit font (Helvetica) has no Hindi/Devanagari glyphs at
    // all — Hindi text would render blank. FreeSans covers both Latin
    // and Devanagari in one font, so it's used for everything below.
    doc.registerFont("Hindi", path.join(__dirname, "../public/fonts/FreeSans.ttf"));
    doc.registerFont("Hindi-Bold", path.join(__dirname, "../public/fonts/FreeSansBold.ttf"));
    doc.font("Hindi");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${ FeeUtils.todayISO() }.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const col = { cycle: 130, due: 55, paid: 55, charity: 55, remaining: 65, status: 60, date: 65 };

    function ensureSpace(height) {
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    }

    function drawCycleTable(cycles) {
      if (!cycles.length) {
        doc.fontSize(9).fillColor("#888").text("कोई Cycle नहीं बना।", { indent: 10 });
        doc.fillColor("#000");
        return;
      }
      ensureSpace(20);
      const startX = doc.x;
      doc.fontSize(8.5).fillColor("#000");
      let x = startX;
      const headers = [["Cycle", col.cycle], ["Due", col.due], ["Paid", col.paid], ["Charity", col.charity], ["Remaining", col.remaining], ["Status", col.status], ["Date", col.date]];
      headers.forEach(([label, w]) => { doc.text(label, x, doc.y, { width: w }); x += w; });
      doc.moveDown(0.3);
      doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).strokeColor("#ccc").stroke();
      doc.moveDown(0.2);

      cycles.slice().reverse().forEach(c => {
        ensureSpace(14);
        const rowY = doc.y;
        let cx = startX;
        doc.fontSize(8.5).fillColor("#000");
        doc.text(FeeUtils.formatCycleRange(c), cx, rowY, { width: col.cycle }); cx += col.cycle;
        doc.text(`₹${ c.amountDue }`, cx, rowY, { width: col.due }); cx += col.due;
        doc.text(`₹${ c.paidSum }`, cx, rowY, { width: col.paid }); cx += col.paid;
        doc.text(c.charitySum > 0 ? `₹${ c.charitySum }` : "-", cx, rowY, { width: col.charity }); cx += col.charity;
        doc.text(`₹${ c.remaining }`, cx, rowY, { width: col.remaining }); cx += col.remaining;
        const statusColor = c.status === "Paid" ? "#2e7d32" : (c.status === "Partial" ? "#e65100" : (c.status === "Unpaid" ? "#c62828" : "#000"));
        doc.fillColor(statusColor).text(c.status, cx, rowY, { width: col.status }); cx += col.status;
        doc.fillColor("#000").text(c.lastDate ? FeeUtils.formatDDMM(c.lastDate) : "-", cx, rowY, { width: col.date });
        doc.moveDown(0.4);
      });
    }

    doc.font("Hindi-Bold").fontSize(18).text("Batches — पूरा Backup", { align: "left" });
    doc.font("Hindi");
    doc.fontSize(9).fillColor("#666").text(`Generated on: ${ generatedOn } — यह Record खास कर Fee के लिए है।`);
    doc.fillColor("#000").moveDown(1);

    doc.font("Hindi-Bold").fontSize(13).text("1. Batch-wise Student/Family Fee Record", { underline: true });
    doc.font("Hindi");
    doc.moveDown(0.5);

    const renderedOwnerKeys = new Set();
    for (const [batchLabel, rows] of batchGroups.entries()) {
      ensureSpace(24);
      doc.font("Hindi-Bold").fontSize(11).fillColor("#000").text(batchLabel);
      doc.font("Hindi");
      doc.moveDown(0.3);

      for (const row of rows) {
        const ownerK = row.ownerType + ":" + row.ownerKey;
        if (renderedOwnerKeys.has(ownerK) && row.ownerType === "family") {
          continue;
        }
        renderedOwnerKeys.add(ownerK);

        const ownerInfo = owners.get(ownerK);
        const membersLabel = row.ownerType === "family"
          ? `Family (Code: ${ row.ownerKey }) — ${ ownerInfo.currentMembers.join(", ") }`
          : `${ row.name }${ row.identity ? ` (${ row.identity })` : "" }`;
        const admissionLine = row.ownerType === "family"
          ? rows.filter(r => r.ownerKey === row.ownerKey).map(r => `${ r.name }: ${ r.admissionDate || "—" }`).join(" · ")
          : (row.admissionDate || "—");

        ensureSpace(30);
        doc.fontSize(10).fillColor("#000").text(`${ membersLabel }  [${ row.status }]${ row.feeFree ? "  🆓 Free" : "" }`);
        doc.fontSize(8.5).fillColor("#555").text(`Admission Date: ${ admissionLine }`);
        doc.fillColor("#000").moveDown(0.3);

        if (row.feeFree) {
          doc.fontSize(9).fillColor("#888").text("🆓 Free Student — कोई Fee Track नहीं हो रहा।");
          doc.fillColor("#000");
        } else {
          const state = feeStateByKey.get(ownerK);
          if (!state || !state.hasProfile) {
            doc.fontSize(9).fillColor("#888").text("अभी तक कोई Fee Set नहीं है।");
            doc.fillColor("#000");
          } else {
            drawCycleTable(state.cycles);
          }
        }
        doc.moveDown(0.6);
      }
    }

    const oldEntries = Array.from(owners.entries()).filter(([, info]) => !info.currentMembers.length);
    if (oldEntries.length) {
      doc.addPage();
      doc.font("Hindi-Bold").fontSize(13).text("2. पुराने Records (अब किसी की Current Key नहीं)", { underline: true });
      doc.font("Hindi");
      doc.moveDown(0.5);
      for (const [k, info] of oldEntries) {
        const state = feeStateByKey.get(k);
        if (!state || !state.hasProfile) {
          continue;
        }
        const label = info.ownerType === "family"
          ? `🔗 पुराना Family Record (Code: ${ info.ownerKey }) — पहले साथ थे: ${ info.formerMembers.join(", ") }`
          : `🔗 पुराना Individual Record — ${ info.formerMembers.join(", ") }`;
        ensureSpace(24);
        doc.fontSize(10).text(label);
        doc.moveDown(0.3);
        drawCycleTable(state.cycles);
        doc.moveDown(0.6);
      }
    }

    doc.addPage();
    doc.font("Hindi-Bold").fontSize(13).text("Monthly Collection Summary", { underline: true });
    doc.font("Hindi");
    doc.moveDown(0.5);
    if (!sortedMonths.length) {
      doc.fontSize(9).fillColor("#888").text("कोई Cycle नहीं मिला।");
      doc.fillColor("#000");
    } else {
      const mcol = { cycle: 170, due: 70, paid: 70, charity: 70, pending: 70 };
      let mx = doc.x;
      doc.fontSize(9).fillColor("#000");
      [["Cycle", mcol.cycle], ["कुल Due", mcol.due], ["कुल Paid", mcol.paid], ["Charity", mcol.charity], ["कुल Pending", mcol.pending]]
        .forEach(([label, w]) => { doc.text(label, mx, doc.y, { width: w }); mx += w; });
      doc.moveDown(0.3);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + pageWidth, doc.y).strokeColor("#ccc").stroke();
      doc.moveDown(0.2);

      sortedMonths.forEach(m => {
        ensureSpace(14);
        const rowY = doc.y;
        let cx = doc.page.margins.left;
        doc.fontSize(9).fillColor("#000");
        doc.text(FeeUtils.formatCycleRange(m.cycle), cx, rowY, { width: mcol.cycle }); cx += mcol.cycle;
        doc.text(`₹${ m.due }`, cx, rowY, { width: mcol.due }); cx += mcol.due;
        doc.text(`₹${ m.paid }`, cx, rowY, { width: mcol.paid }); cx += mcol.paid;
        doc.text(m.charity > 0 ? `₹${ m.charity }` : "-", cx, rowY, { width: mcol.charity }); cx += mcol.charity;
        doc.text(`₹${ m.due - m.paid - m.charity }`, cx, rowY, { width: mcol.pending });
        doc.moveDown(0.4);
      });
    }

    doc.end();

  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).send("PDF नहीं बन सका। दोबारा कोशिश करें।");
    }
  }
});

module.exports = router;
