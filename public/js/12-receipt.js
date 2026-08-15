/* =====================================================
   MONTH-TEXT SUGGESTION
   "X तक Clear" = the latest cycle such that it AND every
   cycle before it are fully settled (paid or charity),
   walking from the earliest cycle and stopping at the
   first one that still has something remaining.
===================================================== */
function suggestClearUpToText(cycles) {
  let lastCleared = null;
  for (const c of cycles) {
    if (c.remaining <= 0) {
      lastCleared = c;
    } else {
      break;
    }
  }
  if (!lastCleared) {
    return "";
  }
  return `${ FeeUtils.formatHindiDate(lastCleared.dueDate) } तक Clear`;
}


let currentReceiptCycle = null;
let currentReceiptOwner = null;
let generatedReceiptBlob = null;
let generatedReceiptNo = null;


/* =====================================================
   OPEN RECEIPT FORM (from a cycle row in the fee card)
===================================================== */
function openReceiptModal(cycleKey) {
  const owner = currentFeeOwner;
  const student = currentFeeStudent;
  const cycle = cycleKey ? (currentFeeData.cycles || []).find(c => c.cycleKey === cycleKey) : null;

  currentReceiptOwner = owner;
  currentReceiptCycle = cycle;
  generatedReceiptBlob = null;
  generatedReceiptNo = null;

  const suggestedMonth = suggestClearUpToText(currentFeeData.cycles || []);
  const defaultAmount = cycle ? cycle.paidSum : "";
  const defaultDate = (cycle && cycle.lastDate) ? cycle.lastDate : new Date().toISOString().slice(0, 10);

  document.getElementById("receiptModalBody").innerHTML = `
        <div class="field">
            <label>Student's Name</label>
            <input id="rfStudentName" type="text" value="${ escapeHtml(student.name) }">
        </div>
        <div class="field">
            <label>Father's Name</label>
            <input id="rfFatherName" type="text">
        </div>
        <div class="field">
            <label>Address</label>
            <input id="rfAddress" type="text">
        </div>
        <div class="field">
            <label>Class</label>
            <input id="rfClass" type="text">
        </div>
        <div class="field">
            <label>Month</label>
            <input id="rfMonth" type="text" value="${ escapeHtml(suggestedMonth) }">
        </div>
        <div class="field">
            <label>Payment Date</label>
            <input id="rfDate" type="date" value="${ defaultDate }">
        </div>
        <div class="field">
            <label>Admission Fee (₹)</label>
            <input id="rfAdmissionFee" type="number" placeholder="0" oninput="recalcReceiptTotal()">
        </div>
        <div class="field">
            <label>Tuition Fee (₹)</label>
            <input id="rfTuitionFee" type="number" placeholder="0" oninput="recalcReceiptTotal()">
        </div>
        <div class="field">
            <label>Others Charges (₹)</label>
            <input id="rfOthersCharges" type="number" placeholder="0" oninput="recalcReceiptTotal()">
        </div>
        <div class="field">
            <label>Total (₹)</label>
            <input id="rfTotal" type="number" value="${ defaultAmount }">
        </div>
        <div class="field">
            <label>Total Rs. (in Words)</label>
            <input id="rfTotalWords" type="text">
        </div>
        <div class="field">
            <label>Please Note</label>
            <input id="rfNote" type="text">
        </div>
    `;

  document.getElementById("receiptModalActions").innerHTML = `
        <button class="btn-main" onclick="generateReceipt()">Receipt Generate करें</button>
        <button class="btn-light" onclick="closeReceiptModal()">Close</button>
    `;

  document.getElementById("receiptOverlay").style.display = "flex";
}

function recalcReceiptTotal() {
  const a = Number(document.getElementById("rfAdmissionFee").value) || 0;
  const t = Number(document.getElementById("rfTuitionFee").value) || 0;
  const o = Number(document.getElementById("rfOthersCharges").value) || 0;
  const sum = a + t + o;
  if (sum > 0) {
    document.getElementById("rfTotal").value = sum;
  }
}


/* =====================================================
   GENERATE: save the receipt, then render + capture image
===================================================== */
async function generateReceipt() {
  const owner = currentReceiptOwner;

  const total = Number(document.getElementById("rfTotal").value) || 0;
  if (total <= 0) {
    alert("Total Amount भरें");
    return;
  }

  const body = {
    ownerType: owner.ownerType,
    ownerKey: owner.ownerKey,
    cycleKey: currentReceiptCycle ? currentReceiptCycle.cycleKey : "",
    date: document.getElementById("rfDate").value || new Date().toISOString().slice(0, 10),
    studentName: document.getElementById("rfStudentName").value,
    fatherName: document.getElementById("rfFatherName").value,
    address: document.getElementById("rfAddress").value,
    board: "CBSE/Bihar",
    studentClass: document.getElementById("rfClass").value,
    monthText: document.getElementById("rfMonth").value,
    admissionFee: Number(document.getElementById("rfAdmissionFee").value) || 0,
    tuitionFee: Number(document.getElementById("rfTuitionFee").value) || 0,
    othersCharges: Number(document.getElementById("rfOthersCharges").value) || 0,
    total,
    totalInWords: document.getElementById("rfTotalWords").value,
    note: document.getElementById("rfNote").value
  };

  try {
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Receipt Save नहीं हुई");
      return;
    }
    await renderAndShowReceipt(data.receipt);
  } catch (error) {
    alert("Receipt Save नहीं हो सकी। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   FILL THE HIDDEN TEMPLATE + CAPTURE AS IMAGE
===================================================== */
async function renderAndShowReceipt(receipt) {
  generatedReceiptNo = receipt.receiptNo;

  document.getElementById("rNo").textContent = receipt.receiptNo;
  document.getElementById("rDate").textContent = FeeUtils.formatDDMM(receipt.date);
  document.getElementById("rStudentName").textContent = receipt.studentName;
  document.getElementById("rFatherName").textContent = receipt.fatherName;
  document.getElementById("rAddress").textContent = receipt.address;
  document.getElementById("rClass").textContent = receipt.studentClass;
  document.getElementById("rMonth").textContent = receipt.monthText;
  document.getElementById("rAdmissionFee").textContent = receipt.admissionFee > 0 ? receipt.admissionFee : "";
  document.getElementById("rTuitionFee").textContent = receipt.tuitionFee > 0 ? receipt.tuitionFee : "";
  document.getElementById("rOthersCharges").textContent = receipt.othersCharges > 0 ? receipt.othersCharges : "";
  document.getElementById("rNote").textContent = receipt.note;
  document.getElementById("rTotal").textContent = receipt.total;
  document.getElementById("rTotalWords").textContent = receipt.totalInWords;

  const modalBody = document.getElementById("receiptModalBody");
  modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Image बन रही है...</div></div>`;
  document.getElementById("receiptModalActions").innerHTML = `
        <button class="btn-light" onclick="closeReceiptModal()">Close</button>
    `;

  try {
    const canvas = await html2canvas(document.getElementById("receiptTemplate"), {
      backgroundColor: "#fbdde3",
      scale: 2
    });
    canvas.toBlob(blob => {
      generatedReceiptBlob = blob;
      showReceiptPreview(receipt.receiptNo, blob);
    }, "image/png");
  } catch (error) {
    modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Receipt No. ${ receipt.receiptNo } Save हो गई, लेकिन Image नहीं बन सकी। इंटरनेट/browser चेक करें।</div></div>`;
  }
}

function showReceiptPreview(receiptNo, blob) {
  const url = URL.createObjectURL(blob);
  const modalBody = document.getElementById("receiptModalBody");

  modalBody.innerHTML = `
        <div class="receipt-search-result">
            <div><strong>Receipt No. ${ receiptNo }</strong></div>
            <img class="receipt-preview-img" src="${ url }">
            <div class="receipt-share-actions">
                <a class="btn-main" download="Receipt-${ receiptNo }.png" href="${ url }">Download</a>
                <button class="btn-light" onclick="shareReceiptImage(${ receiptNo })">Share</button>
            </div>
        </div>
    `;

  document.getElementById("receiptModalActions").innerHTML = `
        <button class="btn-light" onclick="closeReceiptModal()">Close</button>
    `;
}

async function shareReceiptImage(receiptNo) {
  if (!generatedReceiptBlob) {
    return;
  }
  const file = new File([generatedReceiptBlob], `Receipt-${ receiptNo }.png`, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Receipt ${ receiptNo }` });
    } catch (error) {
      // user cancelled share — nothing to do
    }
  } else {
    alert("इस डिवाइस/browser पर सीधे Share उपलब्ध नहीं है। Download करके WhatsApp पर भेजें।");
  }
}

function closeReceiptModal() {
  document.getElementById("receiptOverlay").style.display = "none";
}


/* =====================================================
   SEARCH RECEIPT BY NUMBER
===================================================== */
function openReceiptSearchModal() {
  document.getElementById("receiptModalBody").innerHTML = `
        <div class="field">
            <label>Receipt No.</label>
            <input id="rsReceiptNo" type="number" placeholder="जैसे: 2101">
        </div>
    `;
  document.getElementById("receiptModalActions").innerHTML = `
        <button class="btn-main" onclick="searchReceipt()">खोजें</button>
        <button class="btn-light" onclick="closeReceiptModal()">Close</button>
    `;
  document.getElementById("receiptOverlay").style.display = "flex";
}

async function searchReceipt() {
  const receiptNo = document.getElementById("rsReceiptNo").value;
  if (!receiptNo) {
    alert("Receipt No. भरें");
    return;
  }

  try {
    const res = await fetch(`/api/receipts/${ receiptNo }`);
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Receipt नहीं मिली");
      return;
    }
    await renderAndShowReceipt(data.receipt);
  } catch (error) {
    alert("खोज नहीं हो सकी। इंटरनेट चेक करें।");
  }
}
