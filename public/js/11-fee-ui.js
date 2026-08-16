/* =====================================================
   FEE OWNER HELPERS
===================================================== */
function getFeeOwner(student) {
  if (student.familyCode) {
    return { ownerType: "family", ownerKey: student.familyCode };
  }
  return { ownerType: "student", ownerKey: student.id };
}

let currentFeeOwner = null;
let currentFeeData = null;
let currentFeeStudent = null;

/* =====================================================
   LOAD + RENDER FEE CARD
===================================================== */
async function loadFeeCard(student) {
  currentFeeStudent = student;
  const owner = getFeeOwner(student);
  currentFeeOwner = owner;

  const body = document.getElementById("feeCardBody");
  if (!body) {
    return;
  }
  body.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  try {
    const res = await fetch(`/api/fees/${ owner.ownerType }/${ owner.ownerKey }`);
    const data = await res.json();
    currentFeeData = data;
    renderFeeCard(data);
  } catch (error) {
    body.innerHTML = `<div class="empty">Fee data load नहीं हुआ।</div>`;
  }
}

function renderFeeCard(data) {
  const body = document.getElementById("feeCardBody");
  if (!body) {
    return;
  }

  if (!data.success) {
    body.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
    return;
  }

  if (!data.hasProfile) {
    body.innerHTML = `
            <div class="empty">अभी तक Fee तय नहीं है।</div>
            <div class="fee-actions">
                <button class="btn-main" onclick="openFeeSetupModal()">Set Fee</button>
            </div>
        `;
    return;
  }

  const profile = data.activeProfile;
  const modeLabel = profile.feeMode === "individual" ? "Family (Individual Fee)"
    : profile.feeMode === "total" ? "Family (Total Fee)"
    : "Solo";

  const amountLine = profile.feeMode === "individual"
    ? profile.memberFees.map(m => `${ escapeHtml(m.studentId) }: ₹${ m.amount }`).join(", ")
    : `₹${ profile.amount }`;

  const statusClass = c => c.status.toLowerCase().replace(/[\s/]+/g, "-");

  const cycleRows = data.cycles.slice().reverse().map(c => `
            <div class="fee-row">
                <div class="fee-row-main">
                    <span>${ FeeUtils.formatCycleRange(c) }</span>
                    <span class="fee-status fee-status-${ statusClass(c) }">${ c.status }</span>
                </div>
                <div class="fee-row-sub">
                    Due ₹${ c.amountDue } · Paid ₹${ c.paidSum }${ c.charitySum > 0 ? ` · Charity ₹${ c.charitySum }` : "" } · Remaining ₹${ c.remaining }
                </div>
                ${ c.lastDate ? `<div class="fee-row-sub">${ FeeUtils.formatDDMM(c.lastDate) }</div>` : "" }
                <div class="fee-row-actions">
                    <button class="btn-light small-btn" onclick="openReceiptModal('${ c.cycleKey }')">Receipt बनाएं</button>
                    ${ c.remaining > 0 ? `<button class="btn-light small-btn" onclick="openCharityModal('${ c.cycleKey }')">Charity</button>` : "" }
                </div>
            </div>
        `).join("");

  const admissionFeeLine = profile.admissionFeeAmount > 0
    ? `
            <div class="fee-admission-row">
                Admission Fee: ₹${ profile.admissionFeeAmount }
                ${ profile.admissionFeePaid
                  ? '<span class="fee-status fee-status-paid">Paid</span>'
                  : '<span class="fee-status fee-status-unpaid">Pending</span><button class="btn-light small-btn" onclick="markAdmissionFeePaid()">Paid Mark करें</button>'
                }
            </div>
        `
    : "";

  body.innerHTML = `
        <div class="fee-summary">
            <div><strong>Type:</strong> ${ modeLabel }</div>
            <div><strong>Amount:</strong> ${ amountLine }</div>
            <div><strong>Due Date:</strong> ${ profile.dueDateType } हर महीने</div>
            ${ admissionFeeLine }
            <div class="fee-total-due">Total Due: ₹${ data.totalDue }</div>
        </div>

        <div class="fee-actions">
            <button class="btn-main" onclick="openPaymentModal()">Record Payment</button>
            <button class="btn-light" onclick="openFeeSetupModal()">Edit Fee</button>
        </div>

        <div class="fee-history">
            ${ cycleRows || '<div class="empty">कोई cycle नहीं</div>' }
        </div>
    `;
}

async function markAdmissionFeePaid() {
  const owner = currentFeeOwner;
  try {
    const res = await fetch(`/api/fees/${ owner.ownerType }/${ owner.ownerKey }/admission-fee-paid`, {
      method: "POST"
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Update नहीं हुआ");
      return;
    }
    await loadFeeCard(currentFeeStudent);
  } catch (error) {
    alert("Update नहीं हो सका। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   CHARITY MODAL (per-cycle fee waiver)
===================================================== */
function openCharityModal(cycleKey) {
  const cycle = (currentFeeData.cycles || []).find(c => c.cycleKey === cycleKey);
  if (!cycle) {
    return;
  }

  const modal = document.getElementById("feeOverlay");
  document.getElementById("feeModalTitle").textContent = "Charity दर्ज करें";

  document.getElementById("feeModalBody").innerHTML = `
        <div class="field">
            <label>${ FeeUtils.formatCycleRange(cycle) } (बाकी ₹${ cycle.remaining })</label>
            <input id="feeCharityCycleKey" type="hidden" value="${ cycleKey }">
            <input id="feeCharityAmountInput" type="number" placeholder="Charity Amount (₹)">
        </div>

        <div class="field">
            <label>Date</label>
            <input id="feeCharityDateInput" type="date" value="${ new Date().toISOString().slice(0, 10) }">
        </div>

        <div class="field">
            <label>Note (optional)</label>
            <input id="feeCharityNoteInput" type="text">
        </div>
    `;

  modal.style.display = "flex";
}

async function saveCharity() {
  const owner = currentFeeOwner;
  const cycleKey = document.getElementById("feeCharityCycleKey").value;
  const amount = Number(document.getElementById("feeCharityAmountInput").value) || 0;
  const date = document.getElementById("feeCharityDateInput").value;
  const note = document.getElementById("feeCharityNoteInput").value;

  if (amount <= 0) {
    alert("Charity Amount भरें");
    return;
  }

  try {
    const res = await fetch(`/api/fees/${ owner.ownerType }/${ owner.ownerKey }/charity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleKey, amount, date, note })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Charity Save नहीं हुई");
      return;
    }
    closeFeeModal();
    await loadFeeCard(currentFeeStudent);
  } catch (error) {
    alert("Charity Save नहीं हो सकी। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   FEE SETUP MODAL (create / edit profile)
===================================================== */
function openFeeSetupModal() {
  const owner = currentFeeOwner;
  const isFamily = owner.ownerType === "family";
  const hasProfile = currentFeeData && currentFeeData.hasProfile;
  const profile = hasProfile ? currentFeeData.activeProfile : null;

  let membersFieldsHtml = "";
  if (isFamily) {
    const members = getFamilyMembers(owner.ownerKey);
    membersFieldsHtml = `
            <div class="field" id="individualFeeFields" style="display:none;">
                <label>हर बच्चे की Fee (₹)</label>
                ${ members.map(m => {
                  const existing = profile && profile.feeMode === "individual"
                    ? (profile.memberFees.find(x => x.studentId === m.student.id) || {}).amount
                    : "";
                  return `
                        <div class="fee-member-input">
                            <span>${ escapeHtml(m.student.name) }</span>
                            <input type="number" class="fee-member-amount" data-student-id="${ m.student.id }" value="${ existing || "" }" placeholder="0">
                        </div>
                    `;
                }).join("") }
            </div>
        `;
  }

  const feeModeOptions = isFamily
    ? `
            <option value="total" ${ profile && profile.feeMode === "total" ? "selected" : "" }>Family Total Fee</option>
            <option value="individual" ${ profile && profile.feeMode === "individual" ? "selected" : "" }>Individual Fixed Fee</option>
        `
    : `<option value="fixed">Fixed Fee</option>`;

  const modal = document.getElementById("feeOverlay");
  document.getElementById("feeModalTitle").textContent = hasProfile ? "Fee Update करें" : "Fee तय करें";

  document.getElementById("feeModalBody").innerHTML = `
        <div class="field">
            <label>Fee Type</label>
            <select id="feeModeSelect" onchange="toggleFeeModeFields()">
                ${ feeModeOptions }
            </select>
        </div>

        <div class="field" id="totalAmountField">
            <label>Amount (₹)</label>
            <input id="feeAmountInput" type="number" value="${ profile && profile.feeMode !== "individual" ? profile.amount : "" }">
        </div>

        ${ membersFieldsHtml }

        <div class="field">
            <label>Due Date</label>
            <select id="feeDueDateSelect" ${ !hasProfile ? 'onchange="updateFirstCyclePreview()"' : "" }>
                <option value="1" ${ profile && profile.dueDateType === 1 ? "selected" : "" }>1 तारीख</option>
                <option value="15" ${ profile && profile.dueDateType === 15 ? "selected" : "" }>15 तारीख</option>
            </select>
        </div>

        ${ !hasProfile ? `
        <div class="field">
            <label>Joining Date</label>
            <input id="feeJoiningDateInput" type="date" onchange="updateFirstCyclePreview()">
        </div>

        <div class="field">
            <label>
                <input type="checkbox" id="feePushFirstCycle" onchange="updateFirstCyclePreview()">
                पहली Fee एक Cycle बाद से लूं (देर से join होने पर)
            </label>
            <div class="empty" id="firstCyclePreview" style="text-align:left;padding:4px 0;"></div>
        </div>

        <div class="field">
            <label>Admission Fee (₹, optional)</label>
            <input id="feeAdmissionAmountInput" type="number" placeholder="0">
            <label style="margin-top:6px;">
                <input type="checkbox" id="feeAdmissionPaidInput">
                अभी Paid हो गई
            </label>
        </div>
        ` : "" }

        <div class="empty" style="margin-top:8px;">
            बदलाव अगली Fee Cycle से लागू होगा। मौजूदा/पुरानी Cycle की Amount नहीं बदलेगी।
        </div>
    `;

  modal.style.display = "flex";
  toggleFeeModeFields();
  if (!hasProfile) {
    updateFirstCyclePreview();
  }
}

function updateFirstCyclePreview() {
  const preview = document.getElementById("firstCyclePreview");
  const joiningInput = document.getElementById("feeJoiningDateInput");
  if (!preview || !joiningInput || !joiningInput.value) {
    if (preview) {
      preview.textContent = "";
    }
    return;
  }
  const dueDateType = Number(document.getElementById("feeDueDateSelect").value);
  const pushOne = document.getElementById("feePushFirstCycle").checked;
  let cycle = FeeUtils.getFirstCycleOnOrAfter(dueDateType, joiningInput.value);
  if (pushOne) {
    const after = FeeUtils.nextMonth(
      FeeUtils.parseISODate(cycle.cycleKey).year,
      FeeUtils.parseISODate(cycle.cycleKey).month
    );
    cycle = FeeUtils.cycleForMonth(dueDateType, after.year, after.month);
  }
  preview.textContent = `पहली Fee Cycle: ${ FeeUtils.formatCycleRange(cycle) }`;
}

function toggleFeeModeFields() {
  const mode = document.getElementById("feeModeSelect").value;
  const totalField = document.getElementById("totalAmountField");
  const individualField = document.getElementById("individualFeeFields");
  if (mode === "individual") {
    totalField.style.display = "none";
    if (individualField) {
      individualField.style.display = "block";
    }
  } else {
    totalField.style.display = "block";
    if (individualField) {
      individualField.style.display = "none";
    }
  }
}

async function saveFeeProfile() {
  const owner = currentFeeOwner;
  const feeMode = document.getElementById("feeModeSelect").value;
  const dueDateType = Number(document.getElementById("feeDueDateSelect").value);

  const body = { feeMode, dueDateType };

  if (feeMode === "individual") {
    const inputs = document.querySelectorAll(".fee-member-amount");
    body.memberFees = Array.from(inputs).map(inp => ({
      studentId: inp.dataset.studentId,
      amount: Number(inp.value) || 0
    }));
    body.amount = 0;
  } else {
    body.amount = Number(document.getElementById("feeAmountInput").value) || 0;
  }

  const joiningInput = document.getElementById("feeJoiningDateInput");
  if (joiningInput) {
    if (!joiningInput.value) {
      alert("Joining Date भरें");
      return;
    }
    body.joiningDate = joiningInput.value;
    body.pushFirstCycle = document.getElementById("feePushFirstCycle").checked;
    body.admissionFeeAmount = Number(document.getElementById("feeAdmissionAmountInput").value) || 0;
    body.admissionFeePaid = document.getElementById("feeAdmissionPaidInput").checked;
  }

  try {
    const res = await fetch(`/api/fees/${ owner.ownerType }/${ owner.ownerKey }/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Save नहीं हुआ");
      return;
    }
    closeFeeModal();
    await loadFeeCard(currentFeeStudent);
  } catch (error) {
    alert("Fee Save नहीं हो सकी। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   PAYMENT MODAL
===================================================== */
function openPaymentModal() {
  const owner = currentFeeOwner;
  const dueCycles = (currentFeeData.cycles || []).filter(c => c.remaining > 0);

  const modal = document.getElementById("feeOverlay");
  document.getElementById("feeModalTitle").textContent = "Payment दर्ज करें";

  const cycleRowsHtml = dueCycles.length
    ? dueCycles.map(c => `
            <div class="fee-member-input">
                <span>${ FeeUtils.formatCycleRange(c) } (बाकी ₹${ c.remaining })</span>
                <input type="number" class="fee-payment-amount" data-cycle-key="${ c.cycleKey }" placeholder="0">
            </div>
        `).join("")
    : `<div class="empty">कोई बकाया Cycle नहीं है।</div>`;

  document.getElementById("feeModalBody").innerHTML = `
        <div class="field">
            <label>किस Cycle में कितना जमा हुआ</label>
            ${ cycleRowsHtml }
        </div>

        <div class="field">
            <label>Payment Date</label>
            <input id="feePaymentDateInput" type="date" value="${ new Date().toISOString().slice(0, 10) }">
        </div>

        <div class="field">
            <label>Note (optional)</label>
            <input id="feePaymentNoteInput" type="text" placeholder="जैसे: ₹100 बाकी अगली बार">
        </div>
    `;

  modal.style.display = "flex";
}

async function savePayment() {
  const owner = currentFeeOwner;
  const inputs = document.querySelectorAll(".fee-payment-amount");
  const allocations = Array.from(inputs)
    .map(inp => ({ cycleKey: inp.dataset.cycleKey, amount: Number(inp.value) || 0 }))
    .filter(a => a.amount > 0);

  if (!allocations.length) {
    alert("कम से कम एक Cycle में Amount भरें");
    return;
  }

  const paymentDate = document.getElementById("feePaymentDateInput").value;
  const note = document.getElementById("feePaymentNoteInput").value;

  try {
    const res = await fetch(`/api/fees/${ owner.ownerType }/${ owner.ownerKey }/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentDate, note, allocations })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Payment Save नहीं हुआ");
      return;
    }
    closeFeeModal();
    await loadFeeCard(currentFeeStudent);
  } catch (error) {
    alert("Payment Save नहीं हो सकी। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   MODAL HELPERS
===================================================== */
function closeFeeModal() {
  document.getElementById("feeOverlay").style.display = "none";
}

function saveFeeModal() {
  const title = document.getElementById("feeModalTitle").textContent;
  if (title === "Payment दर्ज करें") {
    savePayment();
  } else if (title === "Charity दर्ज करें") {
    saveCharity();
  } else {
    saveFeeProfile();
  }
}
