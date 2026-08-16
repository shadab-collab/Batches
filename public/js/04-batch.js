/* =====================================================
   OPEN BATCH
===================================================== */
function openBatch(index) {
  currentBatch = index;
  const batch = batches[index];
  document.getElementById("modalTitle").textContent = batch.name + " Manage";
  document.getElementById("batchName").value = batch.name;
  document.getElementById("batchTime").value = batch.time;
  document.getElementById("newStudent").value = "";
  renderStudents();
  document.getElementById("overlay").style.display = "flex";
}
/* =====================================================
   CLOSE MODAL
===================================================== */
function closeModal() {
  document.getElementById("overlay").style.display = "none";
  currentBatch = null;
  render();
}
/* =====================================================
   SAVE BATCH
===================================================== */
function saveBatch() {
  if (currentBatch === null) {
    return;
  }
  const name = document.getElementById("batchName").value.trim();
  const time = document.getElementById("batchTime").value;
  if (name) {
    batches[currentBatch].name = name;
  }
  batches[currentBatch].time = time;
  saveData();
  closeModal();
}
/* =====================================================
   ADD STUDENT
===================================================== */
function addStudent() {
  if (currentBatch === null) {
    return;
  }
  const input = document.getElementById("newStudent");
  const name = input.value.trim();
  if (!name) {
    return;
  }
  batches[currentBatch].students.push(createStudent(name));
  input.value = "";
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   SEND TO INACTIVE
===================================================== */
function deleteStudent(index) {
  if (currentBatch === null) {
    return;
  }
  const student = batches[currentBatch].students[index];
  if (!student) {
    return;
  }
  const ok = confirm(`${ student.name } को Inactive Students में भेजना है?`);
  if (!ok) {
    return;
  }
  student.active = false;
  student.inactiveSince = FeeUtils.todayISO();
  inactiveStudents.push(student);
  batches[currentBatch].students.splice(index, 1);
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   MOVE STUDENT
===================================================== */
function moveStudent(index) {
  if (currentBatch === null)
    return;
  const student = batches[currentBatch].students[index];
  if (!student)
    return;
  const target = prompt(`Student: ${ student.name }\n\n` + `किस Batch में Move करना है?\n\n` + batches.map((batch, i) => i === currentBatch ? "" : `${ i + 1 }. ${ batch.name } — ${ formatTime(batch.time) }`).filter(Boolean).join("\n") + `\n\nBatch number लिखें (1-10):`);
  if (target === null)
    return;
  const targetIndex = Number(target) - 1;
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= batches.length || targetIndex === currentBatch) {
    alert("सही Batch number चुनें\u0964");
    return;
  }
  batches[targetIndex].students.push(student);
  batches[currentBatch].students.splice(index, 1);
  saveData();
  renderStudents();
  render();
}
/* =====================================================
   RENDER STUDENTS
===================================================== */
function renderStudents() {
  const list = document.getElementById("studentList");
  if (!list || currentBatch === null) {
    return;
  }
  const students = batches[currentBatch].students;
  if (!students.length) {
    list.innerHTML = `<div class="empty">
                कोई Student नहीं
            </div>`;
    return;
  }
  list.innerHTML = students.map((student, i) => `

                <div class="student-row">

                    <div class="serial-manage">
                        ${ i + 1 }.
                    </div>


                    <button
                        class="manage-student-name"
                        data-owner-type="${ student.familyCode ? "family" : "student" }"
                        data-owner-key="${ escapeHtml(student.familyCode || student.id) }"
                        onclick="
                            openStudentProfile(
                                ${ currentBatch },
                                ${ i }
                            )
                        "
                    >
                        ${ escapeHtml(student.name) }
                    </button>


                    <button
                        class="small-btn btn-light"
                        onclick="moveUp(${ i })"
                        ${ i === 0 ? "disabled" : "" }
                    >
                        ↑
                    </button>


                    <button
                        class="small-btn btn-light"
                        onclick="moveDown(${ i })"
                        ${ i === students.length - 1 ? "disabled" : "" }
                    >
                        ↓
                    </button>


                    <button
                        class="small-btn btn-main"
                        onclick="moveStudent(${ i })"
                    >
                        Move
                    </button>


                    <button
                        class="small-btn btn-danger"
                        onclick="deleteStudent(${ i })"
                    >
                        Delete
                    </button>

                </div>

            `).join("");
  if (typeof refreshFeeStatusCache === "function") {
    refreshFeeStatusCache();
  }
}
