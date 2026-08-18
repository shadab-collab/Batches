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

  profileBatchIndex = null;
  profileStudentIndex = null;
  profileInactiveIndex = null;

  if (cameFromInactive) {
    openInactivePage();
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

  document.getElementById("pageStudentName").textContent = student.name;
  document.getElementById("pageStudentIdentity").textContent = student.identity || "";
  document.getElementById("pageStudentBatchRow").style.display = "none";
  document.getElementById("pageStudentTimeRow").style.display = "none";
  document.getElementById("pageStudentPositionRow").style.display = "none";
  document.getElementById("familyActions").style.display = "none";
  document.getElementById("expellActionRow").style.display = "";
  document.getElementById("expelledBanner").style.display = student.expelled ? "" : "none";

  updateFamilyProfile(student);
  loadFeeCard(student);

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
