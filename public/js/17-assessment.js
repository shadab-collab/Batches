let assessmentStudent = null;
let assessmentCard = null;
let generatedAssessmentBlob = null;


/* =====================================================
   SUMMARY (shown directly in the profile, like the Fee card)
===================================================== */
async function loadAssessmentSummary(student) {
  const body = document.getElementById("assessmentCardBody");
  if (!body) {
    return;
  }
  body.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  try {
    const res = await fetch(`/api/assessment/${ student.id }`);
    const data = await res.json();
    if (!data.success) {
      body.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    const card = data.card;
    const hasAnyData = card.studentClass || card.period || card.teacherComment
      || card.improvementEntries.length || card.gapEntries.length;

    if (!hasAnyData) {
      body.innerHTML = `
                <div class="empty">अभी कोई Assessment Data नहीं है</div>
                <div class="fee-actions">
                    <button class="btn-main" onclick="openAssessmentModal()">Formative Assessment Card</button>
                </div>
            `;
      return;
    }

    body.innerHTML = `
        <div class="fee-summary">
            ${ card.studentClass ? `<div><strong>कक्षा:</strong> ${ escapeHtml(card.studentClass) }</div>` : "" }
            ${ card.period ? `<div><strong>मूल्यांकन अवधि:</strong> ${ escapeHtml(card.period) }</div>` : "" }
        </div>
        <div class="assessment-summary-block">
            <div class="assessment-summary-title improvement">🟢 सुधार</div>
            ${ card.improvementEntries.length
              ? card.improvementEntries.map((t, i) => `<div class="assessment-summary-row">${ i + 1 }. ${ escapeHtml(t) }</div>`).join("")
              : '<div class="empty">कोई Entry नहीं</div>' }
        </div>
        <div class="assessment-summary-block">
            <div class="assessment-summary-title gap">🔴 कमी</div>
            ${ card.gapEntries.length
              ? card.gapEntries.map((t, i) => `<div class="assessment-summary-row">${ i + 1 }. ${ escapeHtml(t) }</div>`).join("")
              : '<div class="empty">कोई Entry नहीं</div>' }
        </div>
        ${ card.teacherComment ? `<div class="fee-summary"><strong>शिक्षक की टिप्पणी:</strong> ${ escapeHtml(card.teacherComment) }</div>` : "" }
        <div class="fee-actions">
            <button class="btn-main" onclick="openAssessmentModal()">Edit / Card Generate करें</button>
        </div>
    `;
  } catch (error) {
    body.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}


/* =====================================================
   OPEN / LOAD (edit modal)
===================================================== */
async function openAssessmentModal() {
  const student = getCurrentProfileStudent();
  if (!student) {
    return;
  }
  assessmentStudent = student;
  generatedAssessmentBlob = null;

  document.getElementById("assessmentModalBody").innerHTML = `<div class="empty">लोड हो रहा है...</div>`;
  document.getElementById("assessmentModalActions").innerHTML = `
        <button class="btn-main" onclick="generateAssessmentCard()">Card Generate करें</button>
        <button class="btn-light" onclick="closeAssessmentModal()">Close</button>
    `;
  document.getElementById("assessmentOverlay").style.display = "flex";

  try {
    const res = await fetch(`/api/assessment/${ student.id }`);
    const data = await res.json();
    if (!data.success) {
      document.getElementById("assessmentModalBody").innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }
    assessmentCard = data.card;
    renderAssessmentForm();
  } catch (error) {
    document.getElementById("assessmentModalBody").innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}

function closeAssessmentModal() {
  document.getElementById("assessmentOverlay").style.display = "none";
  // the edit modal may have changed the data — refresh the profile summary behind it
  if (assessmentStudent) {
    loadAssessmentSummary(assessmentStudent);
  }
}


/* =====================================================
   RENDER EDIT FORM
===================================================== */
function entryListHtml(section, entries) {
  if (!entries.length) {
    return `<div class="empty">अभी कोई Entry नहीं</div>`;
  }
  return entries.map((text, i) => `
        <div class="assessment-entry-row">
            <span>${ i + 1 }. ${ escapeHtml(text) }</span>
            <button class="small-btn btn-light" onclick="removeAssessmentEntry('${ section }', ${ i })">हटाएं</button>
        </div>
    `).join("");
}

function renderAssessmentForm() {
  document.getElementById("assessmentModalBody").innerHTML = `
        <div class="field">
            <label>कक्षा</label>
            <input id="asfClass" type="text" value="${ escapeHtml(assessmentCard.studentClass) }" onchange="saveAssessmentMeta()">
        </div>
        <div class="field">
            <label>मूल्यांकन अवधि</label>
            <input id="asfPeriod" type="text" value="${ escapeHtml(assessmentCard.period) }" onchange="saveAssessmentMeta()">
        </div>

        <div class="field">
            <label>🟢 सुधार (अधिकतम 6, नई सबसे ऊपर)</label>
            <div id="asfImprovementList">${ entryListHtml("improvement", assessmentCard.improvementEntries) }</div>
            <div class="assessment-add-row">
                <input id="asfImprovementInput" type="text" placeholder="नई Entry जोड़ें">
                <button class="btn-light small-btn" onclick="addAssessmentEntry('improvement')">जोड़ें</button>
            </div>
        </div>

        <div class="field">
            <label>🔴 कमी (अधिकतम 6, नई सबसे ऊपर)</label>
            <div id="asfGapList">${ entryListHtml("gap", assessmentCard.gapEntries) }</div>
            <div class="assessment-add-row">
                <input id="asfGapInput" type="text" placeholder="नई Entry जोड़ें">
                <button class="btn-light small-btn" onclick="addAssessmentEntry('gap')">जोड़ें</button>
            </div>
        </div>

        <div class="field">
            <label>शिक्षक की टिप्पणी</label>
            <input id="asfComment" type="text" value="${ escapeHtml(assessmentCard.teacherComment) }" onchange="saveAssessmentMeta()">
        </div>
    `;
}


/* =====================================================
   META SAVE
===================================================== */
async function saveAssessmentMeta() {
  const body = {
    studentClass: document.getElementById("asfClass").value,
    period: document.getElementById("asfPeriod").value,
    teacherComment: document.getElementById("asfComment").value
  };
  try {
    const res = await fetch(`/api/assessment/${ assessmentStudent.id }/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      assessmentCard = data.card;
    }
  } catch (error) {
    // meta is auto-saved on blur — a transient failure here isn't worth interrupting the teacher
  }
}


/* =====================================================
   ADD / REMOVE ENTRIES
===================================================== */
async function addAssessmentEntry(section) {
  const inputId = section === "improvement" ? "asfImprovementInput" : "asfGapInput";
  const input = document.getElementById(inputId);
  const text = input.value.trim();
  if (!text) {
    return;
  }

  try {
    const res = await fetch(`/api/assessment/${ assessmentStudent.id }/entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, text })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Save नहीं हुआ");
      return;
    }
    assessmentCard = data.card;
    renderAssessmentForm();
  } catch (error) {
    alert("Save नहीं हो सका। इंटरनेट चेक करें।");
  }
}

async function removeAssessmentEntry(section, index) {
  try {
    const res = await fetch(`/api/assessment/${ assessmentStudent.id }/entry/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, index })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Remove नहीं हो सका");
      return;
    }
    assessmentCard = data.card;
    renderAssessmentForm();
  } catch (error) {
    alert("Remove नहीं हो सका। इंटरनेट चेक करें।");
  }
}


/* =====================================================
   GENERATE CARD IMAGE
   Only filled rows are included — no blank placeholder rows.
===================================================== */
const NUMBER_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

function assessmentListMarkup(entries) {
  if (!entries.length) {
    return `<div class="assessment-empty-note">(कोई Entry नहीं)</div>`;
  }
  return entries.map((text, i) => `<div class="assessment-list-row">${ NUMBER_EMOJI[i] } ${ escapeHtml(text) }</div>`).join("");
}

async function generateAssessmentCard() {
  const student = assessmentStudent;

  document.getElementById("asStudentName").textContent = student.name;
  document.getElementById("asClass").textContent = assessmentCard.studentClass || "-";
  document.getElementById("asPeriod").textContent = assessmentCard.period || "-";
  document.getElementById("asComment").textContent = assessmentCard.teacherComment || "-";
  document.getElementById("asImprovementList").innerHTML = assessmentListMarkup(assessmentCard.improvementEntries);
  document.getElementById("asGapList").innerHTML = assessmentListMarkup(assessmentCard.gapEntries);

  const modalBody = document.getElementById("assessmentModalBody");
  modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Image बन रही है...</div></div>`;
  document.getElementById("assessmentModalActions").innerHTML = `
        <button class="btn-light" onclick="closeAssessmentModal()">Close</button>
    `;

  try {
    const el = document.getElementById("assessmentTemplate");
    const rect = el.getBoundingClientRect();
    const longerEdge = Math.max(rect.width, rect.height);
    const scale = Math.min(4, Math.max(2, 1920 / longerEdge));

    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      letterRendering: true
    });
    canvas.toBlob(blob => {
      generatedAssessmentBlob = blob;
      showAssessmentPreview(blob);
    }, "image/png");
  } catch (error) {
    modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Image नहीं बन सकी। इंटरनेट/browser चेक करें।</div></div>`;
  }
}

function showAssessmentPreview(blob) {
  const url = URL.createObjectURL(blob);
  document.getElementById("assessmentModalBody").innerHTML = `
        <div class="receipt-search-result">
            <img class="receipt-preview-img" src="${ url }">
            <div class="receipt-share-actions">
                <a class="btn-main" download="Assessment-${ assessmentStudent.name }.png" href="${ url }">Download</a>
                <button class="btn-light" onclick="shareAssessmentImage()">Share</button>
            </div>
        </div>
    `;
  document.getElementById("assessmentModalActions").innerHTML = `
        <button class="btn-light" onclick="closeAssessmentModal()">Close</button>
    `;
}

async function shareAssessmentImage() {
  if (!generatedAssessmentBlob) {
    return;
  }
  const file = new File([generatedAssessmentBlob], `Assessment-${ assessmentStudent.name }.png`, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Formative Assessment" });
    } catch (error) {
      // user cancelled — nothing to do
    }
  } else {
    alert("इस डिवाइस/browser पर सीधे Share उपलब्ध नहीं है। Download करके WhatsApp पर भेजें।");
  }
}
