let dashboardActiveTab = "monthly";
let currentAdjustField = null;
let currentAdjustMonth = null;


function currentYearMonth() {
  const d = new Date();
  return `${ d.getFullYear() }-${ String(d.getMonth() + 1).padStart(2, "0") }`;
}

/* One month before whichever yearMonth is passed in (not necessarily
   the real calendar's previous month — used to build the comparison
   card for whatever month the picker is currently showing). */
function monthBefore(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${ d.getFullYear() }-${ String(d.getMonth() + 1).padStart(2, "0") }`;
}

function monthLabel(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const names = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
  return `${ names[m - 1] } ${ y }`;
}


/* =====================================================
   OPEN / CLOSE
===================================================== */
function openDashboardPage() {
  document.getElementById("studentProfilePage").style.display = "none";
  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "none";
  }
  document.getElementById("dashboardPage").style.display = "block";
  window.scrollTo(0, 0);

  const picker = document.getElementById("dashMonthPicker");
  if (!picker.value) {
    picker.value = currentYearMonth();
  }

  switchDashboardView("monthly");
  refreshDashboardSnapshotAndLoad();
}

function closeDashboardPage() {
  document.getElementById("dashboardPage").style.display = "none";
  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  render();
  window.scrollTo(0, 0);
}

function switchDashboardView(view) {
  dashboardActiveTab = view;
  document.getElementById("dashTabMonthly").classList.toggle("active", view === "monthly");
  document.getElementById("dashTabDaily").classList.toggle("active", view === "daily");
  document.getElementById("dashTabWeekly").classList.toggle("active", view === "weekly");

  document.getElementById("dashboardMonthlyView").style.display = view === "monthly" ? "block" : "none";
  document.getElementById("dashboardRangeView").style.display = view === "monthly" ? "none" : "block";

  if (view !== "monthly") {
    const today = new Date().toISOString().slice(0, 10);
    const fromInput = document.getElementById("dashRangeFrom");
    const toInput = document.getElementById("dashRangeTo");
    if (!fromInput.value) {
      fromInput.value = today.slice(0, 8) + "01";
    }
    if (!toInput.value) {
      toInput.value = today;
    }
    loadDashboardRange();
  }
}


/* =====================================================
   CURRENT-MONTH LIVE SNAPSHOT (this is Original data — the
   Adjustment layer below sits on top of it, never replacing it)
===================================================== */
async function refreshDashboardSnapshotAndLoad() {
  const activeStudentCount = batches.reduce((sum, b) => sum + b.students.length, 0);
  const owners = collectFeeOwnersFromBatches();

  let totalMonthlyFeeCommitted = 0;
  try {
    if (owners.length) {
      const res = await fetch("/api/fees/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owners })
      });
      const data = await res.json();
      if (data.success) {
        totalMonthlyFeeCommitted = Object.values(data.statuses)
          .reduce((sum, s) => sum + (s.amountDue || 0), 0);
      }
    }
  } catch (error) {
    // if this specific call fails, totalMonthlyFeeCommitted just stays 0 for
    // this refresh — it must NOT block the snapshot write below, otherwise
    // BOTH numbers silently go stale together
  }

  let snapshotWarning = "";
  try {
    const snapRes = await fetch("/api/dashboard/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yearMonth: currentYearMonth(),
        activeStudentCount,
        totalMonthlyFeeCommitted
      })
    });
    const snapData = await snapRes.json();
    if (snapData.skipped) {
      snapshotWarning = `इस महीने का Data अभी "हाथ से डाला गया" mode में Locked है, इसलिए Live Update नहीं हो रहा। नीचे "Auto में वापस लाएं" दबाएं।`;
    } else if (!snapData.success) {
      snapshotWarning = "Live Update Save नहीं हो सका — Internet/Server चेक करें।";
    }
  } catch (error) {
    snapshotWarning = "Live Update Save नहीं हो सका — Internet/Server चेक करें।";
  }

  loadDashboardMonthly(snapshotWarning);
}


/* =====================================================
   FIELD ROW — shows Final, with Original/Adjustment detail
   and Adjust/Remove buttons when an adjustment exists (or
   could be added).
===================================================== */
function fieldRow(label, fieldKey, fieldData, yearMonth, unit) {
  const prefix = unit === "₹" ? "₹" : "";
  const adjustedNote = fieldData.adjusted
    ? `<div class="dashboard-adjust-note">Original: ${ prefix }${ fieldData.original ?? 0 } · Adjustment: ${ fieldData.adjustment > 0 ? "+" : "" }${ fieldData.adjustment }${ fieldData.reason ? " — " + escapeHtml(fieldData.reason) : "" }</div>`
    : "";

  return `
        <div class="dashboard-row">
            <span>${ label } ${ fieldData.adjusted ? '<span class="dashboard-adjusted-badge">Adjusted</span>' : "" }</span>
            <strong>${ prefix }${ fieldData.final }</strong>
        </div>
        ${ adjustedNote }
        <div class="dashboard-adjust-actions">
            <button class="small-btn btn-light" onclick="openAdjustModal('${ fieldKey }','${ yearMonth }', ${ fieldData.original === null ? "null" : fieldData.original }, ${ fieldData.adjustment === null ? "null" : fieldData.adjustment }, '${ escapeHtml(fieldData.reason || "") }')">Adjust</button>
            ${ fieldData.adjusted ? `<button class="small-btn btn-light" onclick="removeAdjustment('${ fieldKey }','${ yearMonth }')">Remove</button>` : "" }
        </div>
    `;
}

async function loadDashboardMonthly(snapshotWarning) {
  const cardsBox = document.getElementById("dashboardMonthlyCards");
  cardsBox.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  const selectedMonth = document.getElementById("dashMonthPicker").value || currentYearMonth();
  const priorMonth = monthBefore(selectedMonth);
  const isCurrentMonth = selectedMonth === currentYearMonth();

  try {
    const [curRes, prevRes] = await Promise.all([
      fetch(`/api/dashboard/summary?month=${ selectedMonth }`),
      fetch(`/api/dashboard/summary?month=${ priorMonth }`)
    ]);
    const cur = await curRes.json();
    const prev = await prevRes.json();

    if (!cur.success) {
      cardsBox.innerHTML = `<div class="empty">${ escapeHtml(cur.message || "Error") }</div>`;
      return;
    }

    const collectionDiff = cur.totalCollection.final - (prev.success ? prev.totalCollection.final : 0);
    const diffText = collectionDiff === 0
      ? "पिछले महीने जितना ही"
      : (collectionDiff > 0
        ? `+₹${ collectionDiff } पिछले महीने से ज़्यादा`
        : `₹${ Math.abs(collectionDiff) } पिछले महीने से कम`);

    cardsBox.innerHTML = `
            ${ snapshotWarning && isCurrentMonth ? `
                <div class="expelled-banner">
                    ${ escapeHtml(snapshotWarning) }
                    ${ cur.source === "manual" ? `<div style="margin-top:8px;"><button class="btn-main small-btn" onclick="revertToAuto('${ cur.yearMonth }')">Auto में वापस लाएं</button></div>` : "" }
                </div>
            ` : "" }

            <div class="dashboard-card">
                <div class="dashboard-card-title">${ monthLabel(cur.yearMonth) }${ isCurrentMonth ? " (इस महीने)" : "" }</div>
                ${ fieldRow("Active Students", "activeStudents", cur.activeStudents, cur.yearMonth, "") }
                ${ fieldRow("Total Monthly Fee (सभी Active)", "totalMonthlyFee", cur.totalMonthlyFee, cur.yearMonth, "₹") }
                ${ fieldRow(`Collection ${ isCurrentMonth ? "अब तक" : "" } (Tuition)`, "tuitionCollection", cur.tuitionCollection, cur.yearMonth, "₹") }
                ${ fieldRow(`Collection ${ isCurrentMonth ? "अब तक" : "" } (Admission)`, "admissionCollection", cur.admissionCollection, cur.yearMonth, "₹") }
                <div class="dashboard-row"><span>कुल Collection</span><strong>₹${ cur.totalCollection.final }</strong></div>
                ${ cur.source === "manual" ? `
                    <div class="empty">(हाथ से डाला गया Data)</div>
                    <div class="fee-actions">
                        <button class="btn-light small-btn" onclick="openDashboardManualEntry('${ cur.yearMonth }')">Edit करें</button>
                        <button class="btn-danger small-btn" onclick="deleteManualEntry('${ cur.yearMonth }')">Delete करें</button>
                    </div>
                ` : "" }
                <button class="btn-light small-btn" style="margin-top:8px;" onclick="viewAdjustmentHistory('${ cur.yearMonth }')">Adjustment History देखें</button>
            </div>

            <div class="dashboard-card">
                <div class="dashboard-card-title">${ monthLabel(prev.yearMonth || priorMonth) } (पिछला महीना)</div>
                <div class="dashboard-row"><span>Active Students</span><strong>${ prev.success ? (prev.activeStudents.final ?? "-") : "-" }</strong></div>
                <div class="dashboard-row"><span>कुल Collection</span><strong>₹${ prev.success ? prev.totalCollection.final : 0 }</strong></div>
            </div>

            <div class="dashboard-progress">${ diffText }</div>
        `;
  } catch (error) {
    cardsBox.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}


/* =====================================================
   ADJUSTMENT MODAL (reuses the receipt/fee-style overlay pattern)
===================================================== */
function openAdjustModal(field, yearMonth, original, currentAdjustment, currentReason) {
  currentAdjustField = field;
  currentAdjustMonth = yearMonth;

  document.getElementById("dashboardManualBody").innerHTML = `
        <div class="empty">Original: ${ original === null ? "-" : original }</div>
        <div class="field">
            <label>Adjustment (+ या - दोनों चल सकते हैं)</label>
            <input id="dmeAdjustValue" type="number" value="${ currentAdjustment === null ? "" : currentAdjustment }">
        </div>
        <div class="field">
            <label>Reason (optional)</label>
            <input id="dmeAdjustReason" type="text" value="${ escapeHtml(currentReason || "") }">
        </div>
        <div class="empty">Save करने पर पुराना Adjustment पूरी तरह बदल जाएगा (जुड़ेगा नहीं)।</div>
    `;

  const modal = document.getElementById("dashboardManualOverlay");
  const actions = modal.querySelector(".actions");
  actions.innerHTML = `
        <button class="btn-main" onclick="saveAdjustment()">Save</button>
        <button class="btn-light" onclick="closeDashboardManualEntry()">Close</button>
    `;

  modal.style.display = "flex";
}

async function saveAdjustment() {
  const valueInput = document.getElementById("dmeAdjustValue").value;
  if (valueInput === "") {
    alert("Adjustment Value भरें");
    return;
  }
  const value = Number(valueInput);
  const reason = document.getElementById("dmeAdjustReason").value;

  try {
    const res = await fetch("/api/dashboard/adjustment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth: currentAdjustMonth, field: currentAdjustField, value, reason })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Save नहीं हुआ");
      return;
    }
    closeDashboardManualEntry();
    loadDashboardMonthly();
  } catch (error) {
    alert("Save नहीं हो सका। इंटरनेट चेक करें।");
  }
}

async function removeAdjustment(field, yearMonth) {
  if (!confirm("यह Adjustment हटाना है? Final वापस Original हो जाएगा।")) {
    return;
  }
  try {
    const res = await fetch("/api/dashboard/adjustment/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth, field })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Remove नहीं हो सका");
      return;
    }
    loadDashboardMonthly();
  } catch (error) {
    alert("Remove नहीं हो सका। इंटरनेट चेक करें।");
  }
}

const ADJUSTMENT_FIELD_LABELS = {
  activeStudents: "Active Students",
  totalMonthlyFee: "Total Monthly Fee",
  tuitionCollection: "Tuition Collection",
  admissionCollection: "Admission Collection"
};

async function viewAdjustmentHistory(yearMonth) {
  document.getElementById("dashboardManualBody").innerHTML = `<div class="empty">लोड हो रहा है...</div>`;
  const modal = document.getElementById("dashboardManualOverlay");
  modal.querySelector(".actions").innerHTML = `<button class="btn-light" onclick="closeDashboardManualEntry()">Close</button>`;
  modal.style.display = "flex";

  try {
    const res = await fetch(`/api/dashboard/adjustment-history?month=${ yearMonth }`);
    const data = await res.json();
    if (!data.success) {
      document.getElementById("dashboardManualBody").innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    if (!data.logs.length) {
      document.getElementById("dashboardManualBody").innerHTML = `<div class="empty">${ monthLabel(yearMonth) } में कोई Adjustment History नहीं है</div>`;
      return;
    }
    document.getElementById("dashboardManualBody").innerHTML = data.logs.map(l => `
            <div class="dashboard-row" style="flex-direction:column;align-items:flex-start;">
                <div><strong>${ ADJUSTMENT_FIELD_LABELS[l.field] || l.field }</strong> — ${ l.action === "remove" ? "हटाया गया" : (l.value > 0 ? "+" : "") + l.value }</div>
                <div class="empty">${ new Date(l.createdAt).toLocaleString("hi-IN") }${ l.reason ? " — " + escapeHtml(l.reason) : "" }</div>
            </div>
        `).join("");
  } catch (error) {
    document.getElementById("dashboardManualBody").innerHTML = `<div class="empty">Load नहीं हो सका।</div>`;
  }
}


/* =====================================================
   DAILY / WEEKLY BREAKDOWN
===================================================== */
async function loadDashboardRange() {
  const from = document.getElementById("dashRangeFrom").value;
  const to = document.getElementById("dashRangeTo").value;
  const resultsBox = document.getElementById("dashboardRangeResults");
  if (!from || !to) {
    return;
  }

  resultsBox.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  try {
    const groupBy = dashboardActiveTab === "weekly" ? "week" : "day";
    const res = await fetch(`/api/dashboard/range?from=${ from }&to=${ to }&groupBy=${ groupBy }`);
    const data = await res.json();
    if (!data.success) {
      resultsBox.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    if (!data.buckets.length) {
      resultsBox.innerHTML = `<div class="empty">इस अवधि में कोई Collection नहीं है</div>`;
      return;
    }
    resultsBox.innerHTML = data.buckets.map(b => `
            <div class="dashboard-row">
                <span>${ escapeHtml(b.bucket) }</span>
                <strong>₹${ b.amount }</strong>
            </div>
        `).join("");
  } catch (error) {
    resultsBox.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}


/* =====================================================
   MANUAL / HISTORICAL ENTRY (this is Original data for old
   months — separate from the Adjustment layer above)
===================================================== */
async function openDashboardManualEntry(editYearMonth) {
  document.getElementById("dashboardManualBody").innerHTML = `<div class="empty">लोड हो रहा है...</div>`;
  const modal = document.getElementById("dashboardManualOverlay");
  modal.querySelector(".actions").innerHTML = `
        <button class="btn-main" onclick="saveDashboardManualEntry()">Save</button>
        <button class="btn-light" onclick="closeDashboardManualEntry()">Close</button>
    `;
  modal.style.display = "flex";

  let existing = null;
  if (editYearMonth) {
    try {
      const res = await fetch(`/api/dashboard/summary?month=${ editYearMonth }`);
      const data = await res.json();
      if (data.success && data.source === "manual") {
        existing = data;
      }
    } catch (error) {
      // fall through with a blank form
    }
  }

  document.getElementById("dashboardManualBody").innerHTML = `
        <div class="field">
            <label>Year-Month (जैसे 2023-04) — सिर्फ पुराने महीने</label>
            <input id="dmeYearMonth" type="month" value="${ editYearMonth || "" }" max="${ monthBefore(currentYearMonth()) }" ${ editYearMonth ? "disabled" : "" }>
        </div>
        <div class="field">
            <label>Active Students (उस महीने)</label>
            <input id="dmeActiveCount" type="number" value="${ existing ? (existing.activeStudents.original ?? "") : "" }">
        </div>
        <div class="field">
            <label>Tuition Collection (₹)</label>
            <input id="dmeCollection" type="number" value="${ existing ? existing.tuitionCollection.original : "" }">
        </div>
        <div class="field">
            <label>Admission Fee Collection (₹)</label>
            <input id="dmeAdmissionCollection" type="number" value="${ existing ? existing.admissionCollection.original : "" }">
        </div>
    `;
}

function closeDashboardManualEntry() {
  document.getElementById("dashboardManualOverlay").style.display = "none";
}

async function saveDashboardManualEntry() {
  const yearMonthInput = document.getElementById("dmeYearMonth");
  const yearMonth = yearMonthInput.value;
  if (!yearMonth) {
    alert("Year-Month चुनें");
    return;
  }

  const body = {
    yearMonth,
    activeStudentCount: Number(document.getElementById("dmeActiveCount").value) || 0,
    collection: Number(document.getElementById("dmeCollection").value) || 0,
    admissionCollection: Number(document.getElementById("dmeAdmissionCollection").value) || 0
  };

  try {
    const res = await fetch("/api/dashboard/manual-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Save नहीं हुआ");
      return;
    }
    closeDashboardManualEntry();
    document.getElementById("dashMonthPicker").value = yearMonth;
    loadDashboardMonthly();
  } catch (error) {
    alert("Save नहीं हो सका। इंटरनेट चेक करें।");
  }
}

async function deleteManualEntry(yearMonth) {
  if (!confirm(`${ monthLabel(yearMonth) } का हाथ से डाला Data हमेशा के लिए मिटाना है?`)) {
    return;
  }
  try {
    const res = await fetch("/api/dashboard/manual-entry/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Delete नहीं हो सका");
      return;
    }
    loadDashboardMonthly();
  } catch (error) {
    alert("Delete नहीं हो सका। इंटरनेट चेक करें।");
  }
}

/* =====================================================
   REVERT THE CURRENT REAL MONTH BACK TO LIVE/AUTO TRACKING
   Only ever meant for the actual current month — if it got
   accidentally locked into "manual" mode (e.g. historical
   data entered for the wrong month), this clears that lock
   so the app's own live numbers start updating again.
===================================================== */
async function revertToAuto(yearMonth) {
  if (yearMonth !== currentYearMonth()) {
    return;
  }
  try {
    await fetch("/api/dashboard/manual-entry/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearMonth })
    });
  } catch (error) {
    // fall through — the refresh below will surface any remaining problem
  }
  refreshDashboardSnapshotAndLoad();
}


/* =====================================================
   GROWTH TIMELINE — historical + automatic months together
===================================================== */
async function loadGrowthTimeline() {
  const box = document.getElementById("dashboardTimeline");
  box.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  try {
    const res = await fetch("/api/dashboard/timeline");
    const data = await res.json();
    if (!data.success) {
      box.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    if (!data.timeline.length) {
      box.innerHTML = `<div class="empty">अभी कोई Timeline Data नहीं है</div>`;
      return;
    }
    box.innerHTML = data.timeline.map(t => `
            <div class="dashboard-row">
                <span>${ monthLabel(t.yearMonth) } ${ t.adjusted ? '<span class="dashboard-adjusted-badge">Adjusted</span>' : "" }</span>
                <strong>₹${ t.totalCollectionFinal } · ${ t.activeStudentsFinal ?? "-" } Students</strong>
            </div>
        `).join("");
  } catch (error) {
    box.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}
