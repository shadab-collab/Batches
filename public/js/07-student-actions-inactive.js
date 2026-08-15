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
  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  profileBatchIndex = null;
  profileStudentIndex = null;
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
  if (!inactiveStudents.length) {
    list.innerHTML = `

            <div class="empty">

                कोई Inactive Student नहीं है।

            </div>

        `;
    return;
  }
  list.innerHTML = inactiveStudents.map((student, index) => {
    const familyText = student.familyCode ? `Family: ${ escapeHtml(student.familyCode) }` : "Solo";
    return `

                        <div
                            class="inactive-student-card"
                        >

                            <div
                                class="inactive-student-number"
                            >
                                ${ index + 1 }.
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


                            <button
                                class="small-btn btn-green"
                                onclick="
                                    reactivateStudent(
                                        ${ index }
                                    )
                                "
                            >
                                Reactive
                            </button>

                        </div>

                    `;
  }).join("");
}
/* =====================================================
   REACTIVE STUDENT
===================================================== */
function reactivateStudent(index) {
  const student = inactiveStudents[index];
  if (!student) {
    return;
  }
  const batchList = batches.map((batch, i) => `${ i + 1 }. ${ batch.name } — ${ formatTime(batch.time) }`).join("\n");
  const target = prompt(`Student: ${ student.name }\n\n` + `किस Batch में वापस भेजना है?\n\n` + batchList + `\n\nBatch number लिखें (1-10):`);
  if (target === null) {
    return;
  }
  const targetIndex = Number(target) - 1;
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= batches.length) {
    alert("सही Batch number चुनें\u0964");
    return;
  }
  /*
       Student को Active करें
    */
  student.active = true;
  /*
       चुने हुए Batch में डालें
    */
  batches[targetIndex].students.push(student);
  /*
       Inactive से हटाएँ
    */
  inactiveStudents.splice(index, 1);
  saveData();
  renderInactiveStudents();
  render();
}
/* =====================================================
