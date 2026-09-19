/* =====================================================
   SEND STUDENT TO INACTIVE
===================================================== */
function sendStudentToInactive() {
  if (profileBatchIndex === null || profileStudentIndex === null) {
    return;
  }
  const student = batches[profileBatchIndex].students[profileStudentIndex];
  if (!student) {
    return;
  }
  const ok = confirm(`${ student.name } को Inactive Students में भेजना है?`);
  if (!ok) {
    return;
  }
  /*
       Family Code को बरकरार रखा जाएगा।
    */
  student.active = false;
  student.inactiveSince = FeeUtils.todayISO();
  student.away = false;
  student.awaySince = "";
  inactiveStudents.push(student);
  batches[profileBatchIndex].students.splice(profileStudentIndex, 1);
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
  const cameFromAway = profileCameFromAway;

  profileBatchIndex = null;
  profileStudentIndex = null;
  profileInactiveIndex = null;
  profileCameFromAway = false;

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
  profileCameFromAway = false;

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
   Student stays exactly where it is in batches[].students —
   still counted in the Batch's total headcount and its Fee
   record keeps running normally. Only the Batch's working
   list and the daily Attendance screen stop showing them
   (their Attendance auto-marks Absent instead, every day the
   batch's attendance gets submitted).
===================================================== */
function sendStudentToAway() {
  if (profileBatchIndex === null || profileStudentIndex === null) {
    return;
  }
  const student = batches[profileBatchIndex].students[profileStudentIndex];
  if (!student) {
    return;
  }
  const ok = confirm(`${ student.name } को Temporarily Away करना है?\n\nFee/Family Record जस का तस चलता रहेगा, बस List और Attendance से हट जाएगा।`);
  if (!ok) {
    return;
  }
  student.away = true;
  student.awaySince = FeeUtils.todayISO();
  saveData();
  openStudentProfile(profileBatchIndex, profileStudentIndex);
  render();
}
/* =====================================================
   RETURN STUDENT FROM AWAY TO ACTIVE
===================================================== */
function returnStudentFromAway() {
  if (profileBatchIndex === null || profileStudentIndex === null) {
    return;
  }
  const student = batches[profileBatchIndex].students[profileStudentIndex];
  if (!student) {
    return;
  }
  student.away = false;
  student.awaySince = "";
  saveData();
  openStudentProfile(profileBatchIndex, profileStudentIndex);
  render();
}
/* =====================================================
   AWAY STUDENTS — COMBINED LIST
   Away students never leave their batch's students array (so
   the batch's headcount still counts them) — this scans every
   batch fresh each time, purely for a convenient combined view.
===================================================== */
function getAwayEntries() {
  const entries = [];
  batches.forEach((batch, batchIndex) => {
    batch.students.forEach((student, studentIndex) => {
      if (student.away) {
        entries.push({ batch, batchIndex, studentIndex, student });
      }
    });
  });
  return entries;
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
  const entries = getAwayEntries();
  if (!entries.length) {
    list.innerHTML = `
            <div class="empty">
                कोई Student Temporarily Away नहीं है।
            </div>
        `;
    return;
  }
  list.innerHTML = entries.map((entry, position) => {
    const student = entry.student;
    const familyText = student.familyCode ? `Family: ${ escapeHtml(student.familyCode) }` : "Solo";
    const sinceText = student.awaySince ? ` · ${ FeeUtils.formatDDMM(student.awaySince) } से` : "";
    return `

                        <div
                            class="inactive-student-card"
                            onclick="openStudentProfile(${ entry.batchIndex }, ${ entry.studentIndex }, true)"
                            style="cursor:pointer;"
                        >

                            <div class="inactive-student-number">
                                ${ position + 1 }.
                            </div>

                            <div class="inactive-student-info">
                                <strong>${ escapeHtml(student.name) }</strong>
                                <span>${ escapeHtml(entry.batch.name) } · ${ familyText }${ sinceText }</span>
                            </div>

                        </div>

                    `;
  }).join("");
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
