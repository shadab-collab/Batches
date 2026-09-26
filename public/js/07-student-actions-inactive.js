/* =====================================================
   SEND STUDENT TO INACTIVE
   Works from a normal Active profile OR from an Away profile —
   whichever one is currently open decides where the student is
   spliced out from.
===================================================== */
function sendStudentToInactive() {
  let student = null;

  if (profileAwayIndex !== null) {
    student = awayStudents[profileAwayIndex];
    if (student) {
      awayStudents.splice(profileAwayIndex, 1);
    }
  } else if (profileBatchIndex !== null && profileStudentIndex !== null) {
    student = batches[profileBatchIndex].students[profileStudentIndex];
    if (student) {
      batches[profileBatchIndex].students.splice(profileStudentIndex, 1);
    }
  }

  if (!student) {
    return;
  }
  const ok = confirm(`${ student.name } को Inactive Students में भेजना है?`);
  if (!ok) {
    // वापस जहाँ से निकाला था, वहीं रख दें — Cancel करने पर कुछ बिगड़े नहीं
    if (profileAwayIndex !== null) {
      awayStudents.splice(profileAwayIndex, 0, student);
    } else if (profileBatchIndex !== null && profileStudentIndex !== null) {
      batches[profileBatchIndex].students.splice(profileStudentIndex, 0, student);
    }
    return;
  }
  /*
       Family Code को बरकरार रखा जाएगा।
    */
  student.active = false;
  student.inactiveSince = FeeUtils.todayISO();
  student.awaySince = "";
  student.awayBatchId = "";
  student.awayBatchName = "";
  inactiveStudents.push(student);
  saveData();
  closeStudentProfilePage();
  render();
}
/* =====================================================
   CLOSE STUDENT PROFILE
===================================================== */
function closeStudentProfilePage() {
  document.getElementById("studentProfilePage").style.display = "none";

  const cameFromInactive = profileInactiveIndex !== null;
  const cameFromAway = profileAwayIndex !== null;

  profileBatchIndex = null;
  profileStudentIndex = null;
  profileInactiveIndex = null;
  profileAwayIndex = null;

  if (cameFromInactive) {
    openInactivePage();
    return;
  }

  if (cameFromAway) {
    openAwayPage();
    return;
  }

  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  render();
  window.scrollTo(0, 0);
}
/* =====================================================
   CLOSE PROFILE
===================================================== */
function closeStudentProfile() {
  closeStudentProfilePage();
}
/* =====================================================
   SAVE STUDENT PROFILE
===================================================== */
function saveStudentProfile() {
  if (profileBatchIndex === null || profileStudentIndex === null) {
    return;
  }
  const student = batches[profileBatchIndex].students[profileStudentIndex];
  if (!student) {
    return;
  }
  const input = document.getElementById("profileStudentName");
  if (!input) {
    return;
  }
  const name = input.value.trim();
  if (!name) {
    alert("Student का नाम खाली नहीं हो सकता\u0964");
    return;
  }
  student.name = name;
  saveData();
  document.getElementById("pageStudentName").textContent = name;
  updateFamilyProfile(student);
  render();
}
/* =====================================================
   INACTIVE PAGE
===================================================== */
function openInactivePage() {
  document.getElementById("studentProfilePage").style.display = "none";
  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "none";
  }
  const awayPageEl = document.getElementById("awayStudentsPage");
  if (awayPageEl) {
    awayPageEl.style.display = "none";
  }
  document.getElementById("inactiveStudentsPage").style.display = "block";
  renderInactiveStudents();
  window.scrollTo(0, 0);
}
/* =====================================================
   CLOSE INACTIVE PAGE
===================================================== */
function closeInactivePage() {
  document.getElementById("inactiveStudentsPage").style.display = "none";
  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  render();
  window.scrollTo(0, 0);
}
/* =====================================================
   RENDER INACTIVE STUDENTS
===================================================== */
function renderInactiveStudents() {
  const list = document.getElementById("inactiveStudentList");
  if (!list) {
    return;
  }
  const visibleStudents = inactiveStudents
    .map((student, index) => ({ student, index }))
    .filter(entry => !entry.student.expelled);

  if (!visibleStudents.length) {
    list.innerHTML = `

            <div class="empty">

                कोई Inactive Student नहीं है।

            </div>

        `;
    return;
  }
  list.innerHTML = visibleStudents.map((entry, position) => {
    const student = entry.student;
    const familyText = student.familyCode ? `Family: ${ escapeHtml(student.familyCode) }` : "Solo";
    return `

                        <div
                            class="inactive-student-card"
                            onclick="openInactiveStudentProfile(${ entry.index })"
                            style="cursor:pointer;"
                        >

                            <div
                                class="inactive-student-number"
                            >
                                ${ position + 1 }.
                            </div>


                            <div
                                class="inactive-student-info"
                            >

                                <strong>
                                    ${ escapeHtml(student.name) }
                                </strong>

                                <span>
                                    ${ familyText }
                                </span>

                            </div>

                        </div>

                    `;
  }).join("");
}


/* =====================================================
   OPEN INACTIVE STUDENT PROFILE
   (same profile page as an active student, minus batch
   info and family actions, plus an Expell option)
===================================================== */
function openInactiveStudentProfile(index) {
  const student = inactiveStudents[index];
  if (!student) {
    return;
  }

  profileBatchIndex = null;
  profileStudentIndex = null;
  profileInactiveIndex = index;
  profileAwayIndex = null;

  document.getElementById("pageStudentName").textContent = student.name;
  document.getElementById("pageStudentIdentity").textContent = student.identity || "";
  document.getElementById("pageStudentAdmissionDate").value = student.admissionDate || "";
  document.getElementById("pageStudentFeeFree").checked = !!student.feeFree;
  document.getElementById("pageStudentBatchRow").style.display = "none";
  document.getElementById("pageStudentTimeRow").style.display = "none";
  document.getElementById("pageStudentPositionRow").style.display = "none";
  document.getElementById("familyActions").style.display = "none";
  document.getElementById("awayBanner").style.display = "none";
  document.getElementById("awayActionsRow").style.display = "none";
  document.getElementById("expellActionRow").style.display = "";
  document.getElementById("expelledBanner").style.display = student.expelled ? "" : "none";

  updateFamilyProfile(student);
  loadFeeCard(student);
  loadAssessmentSummary(student);
  loadAttendanceSummary(student);

  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveButton = document.querySelector(".inactive-home-wrap");
  if (inactiveButton) {
    inactiveButton.style.display = "none";
  }
  document.getElementById("inactiveStudentsPage").style.display = "none";
  const awayPageEl2 = document.getElementById("awayStudentsPage");
  if (awayPageEl2) {
    awayPageEl2.style.display = "none";
  }
  document.getElementById("studentProfilePage").style.display = "block";
  window.scrollTo(0, 0);
}


/* =====================================================
   EXPELL STUDENT
   Removes the student from active/inactive lists and any
   future fee/receipt/reminder operations. Historical
   Fee/Payment/Receipt records already saved are never
   touched — they simply stop being reachable through the
   student's profile, since the profile itself disappears.
===================================================== */
function expellStudent() {
  if (profileInactiveIndex === null) {
    return;
  }
  const student = inactiveStudents[profileInactiveIndex];
  if (!student) {
    return;
  }
  const ok = confirm(`${ student.name } को Expell करना है?\n\nपुराना Fee/Payment data हमेशा सुरक्षित रहेगा, लेकिन यह Student अब किसी भी list में नहीं दिखेगा और इसके लिए आगे कोई नया Fee/Receipt/Reminder नहीं बनेगा।`);
  if (!ok) {
    return;
  }
  student.expelled = true;
  saveData();
  closeStudentProfilePage();
}
/* =====================================================
   SEND STUDENT TO TEMPORARY AWAY
   Student is moved OUT of batches[].students into its own
   top-level awayStudents list — the exact same, already-proven
   mechanism Inactive uses (rather than a flag buried inside the
   batch's own array). The batch it came from is remembered
   (awayBatchId/awayBatchName) so it can go back to the right
   place later, and so the batch's headcount can still count it.
===================================================== */
function sendStudentToAway() {
  if (profileBatchIndex === null || profileStudentIndex === null) {
    return;
  }
  const batch = batches[profileBatchIndex];
  const student = batch.students[profileStudentIndex];
  if (!student) {
    return;
  }
  const ok = confirm(`${ student.name } को Temporarily Away करना है?\n\nFee/Family Record जस का तस चलता रहेगा, बस List और Attendance से हट जाएगा।`);
  if (!ok) {
    return;
  }
  student.awaySince = FeeUtils.todayISO();
  student.awayBatchId = batch.id;
  student.awayBatchName = batch.name;
  awayStudents.push(student);
  batch.students.splice(profileStudentIndex, 1);
  saveData();
  closeStudentProfilePage();
  render();
}
/* =====================================================
   RETURN STUDENT FROM AWAY TO ACTIVE
   Puts the student back into the batch it came from (matched
   by id, not position, since batches can be added/removed/
   reordered while someone was away). If that batch no longer
   exists, the student is sent to Inactive instead, purely as a
   safety net so nobody is ever silently lost.
===================================================== */
function returnStudentFromAway() {
  if (profileAwayIndex === null) {
    return;
  }
  const student = awayStudents[profileAwayIndex];
  if (!student) {
    return;
  }
  const targetBatch = batches.find(b => b.id === student.awayBatchId);
  awayStudents.splice(profileAwayIndex, 1);
  student.awaySince = "";
  student.awayBatchId = "";
  student.awayBatchName = "";
  if (targetBatch) {
    targetBatch.students.push(student);
  } else {
    student.active = false;
    student.inactiveSince = FeeUtils.todayISO();
    inactiveStudents.push(student);
    alert(`${ student.name } जिस Batch में था वो अब मौजूद नहीं है, इसलिए इसे Inactive में डाल दिया गया है — जरूरत हो तो सही Batch में वापस जोड़ दें।`);
  }
  saveData();
  closeStudentProfilePage();
  render();
}
/* =====================================================
   AWAY PAGE
===================================================== */
function openAwayPage() {
  document.getElementById("studentProfilePage").style.display = "none";
  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "none";
  }
  document.getElementById("inactiveStudentsPage").style.display = "none";
  document.getElementById("awayStudentsPage").style.display = "block";
  renderAwayStudents();
  window.scrollTo(0, 0);
}
/* =====================================================
   CLOSE AWAY PAGE
===================================================== */
function closeAwayPage() {
  document.getElementById("awayStudentsPage").style.display = "none";
  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  render();
  window.scrollTo(0, 0);
}
/* =====================================================
   RENDER AWAY STUDENTS
===================================================== */
function renderAwayStudents() {
  const list = document.getElementById("awayStudentList");
  if (!list) {
    return;
  }
  if (!awayStudents.length) {
    list.innerHTML = `
            <div class="empty">
                कोई Student Temporarily Away नहीं है।
            </div>
        `;
    return;
  }
  list.innerHTML = awayStudents.map((student, index) => {
    const familyText = student.familyCode ? `Family: ${ escapeHtml(student.familyCode) }` : "Solo";
    const sinceText = student.awaySince ? ` · ${ FeeUtils.formatDDMM(student.awaySince) } से` : "";
    return `

                        <div
                            class="inactive-student-card"
                            onclick="openAwayStudentProfile(${ index })"
                            style="cursor:pointer;"
                        >

                            <div class="inactive-student-number">
                                ${ index + 1 }.
                            </div>

                            <div class="inactive-student-info">
                                <strong>${ escapeHtml(student.name) }</strong>
                                <span>${ escapeHtml(student.awayBatchName || "") } · ${ familyText }${ sinceText }</span>
                            </div>

                        </div>

                    `;
  }).join("");
}
/* =====================================================
   OPEN AWAY STUDENT PROFILE
   (same profile page, minus Batch/Position rows and Family
   actions — like Inactive — plus Return/Inactive buttons)
===================================================== */
function openAwayStudentProfile(index) {
  const student = awayStudents[index];
  if (!student) {
    return;
  }

  profileBatchIndex = null;
  profileStudentIndex = null;
  profileInactiveIndex = null;
  profileAwayIndex = index;

  document.getElementById("pageStudentName").textContent = student.name;
  document.getElementById("pageStudentIdentity").textContent = student.identity || "";
  document.getElementById("pageStudentAdmissionDate").value = student.admissionDate || "";
  document.getElementById("pageStudentFeeFree").checked = !!student.feeFree;
  document.getElementById("pageStudentBatch").textContent = student.awayBatchName || "";
  document.getElementById("pageStudentBatchRow").style.display = "";
  document.getElementById("pageStudentTimeRow").style.display = "none";
  document.getElementById("pageStudentPositionRow").style.display = "none";
  document.getElementById("familyActions").style.display = "none";
  document.getElementById("expellActionRow").style.display = "none";
  document.getElementById("expelledBanner").style.display = "none";
  document.getElementById("awayBanner").style.display = "";
  document.getElementById("awayActionsRow").style.display = "";

  updateFamilyProfile(student);
  loadFeeCard(student);
  loadAssessmentSummary(student);
  loadAttendanceSummary(student);

  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveButton = document.querySelector(".inactive-home-wrap");
  if (inactiveButton) {
    inactiveButton.style.display = "none";
  }
  document.getElementById("inactiveStudentsPage").style.display = "none";
  document.getElementById("awayStudentsPage").style.display = "none";
  document.getElementById("studentProfilePage").style.display = "block";
  window.scrollTo(0, 0);
}
/* =====================================================
   BACKUP EXPORT
   Opens a printable, well-formatted page in a new tab with
   every Batch's Fee record + a Monthly Collection summary —
   from there, "Print → Save as PDF" makes the actual backup
   file, ready to upload to Drive. Freshly generated from live
   data every time, no separate storage/upload step needed.
===================================================== */
function openBackupExport() {
  window.open("/api/backup/export-html", "_blank");
}
