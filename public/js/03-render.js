/* =====================================================
   RENDER
===================================================== */
function render() {
  const grid = document.getElementById("batchGrid");
  if (!grid) {
    return;
  }
  grid.innerHTML = "";
  batches.forEach((batch, index) => {
    const box = document.createElement("div");
    box.className = "batch";
    box.onclick = () => openBatch(index);
    let visibleSerial = 0;
    let students = batch.students
      .map((student, i) => ({ student, i }))
      .filter(entry => !entry.student.away)
      .map(entry => {
        const student = entry.student;
        const i = entry.i;
        visibleSerial++;
        return `

                            <div
                                class="student"
                            >

                                <span
                                    class="serial"
                                >
                                    ${ visibleSerial }.
                                </span>

                                <button
                                    class="student-name"
                                    data-owner-type="${ student.familyCode ? "family" : "student" }"
                                    data-owner-key="${ escapeHtml(student.familyCode || student.id) }"
                                    onclick="
                                        event.stopPropagation();
                                        openStudentProfile(
                                            ${ index },
                                            ${ i }
                                        )
                                    "
                                >
                                    ${ escapeHtml(student.name) }
                                    ${ student.identity ? `<span class="student-identity">(${ escapeHtml(student.identity) })</span>` : "" }
                                </button>

                            </div>

                        `;
      }).join("");
    if (!students) {
      students = `<div class="empty">
                        कोई Student नहीं
                    </div>`;
    }
    box.innerHTML = `

                <div
                    class="batch-head"
                >

                    <div
                        class="batch-name"
                    >
                        ${ escapeHtml(batch.name) }
                    </div>

                    <div
                        class="batch-time"
                    >
                        ${ formatTime(batch.time) }
                    </div>

                </div>


                <div
                    class="students"
                >
                    ${ students }
                </div>

            `;
    grid.appendChild(box);
  });
  updateInactiveButton();
  updateAwayButton();
  updateTodoBadge();
  if (typeof refreshFeeStatusCache === "function") {
    refreshFeeStatusCache();
  }
}
/* =====================================================
   INACTIVE BUTTON
===================================================== */
function updateInactiveButton() {
  const button = document.querySelector(".inactive-home-btn");
  if (!button) {
    return;
  }
  if (inactiveStudents.length) {
    button.textContent = `Inactive Students (${ inactiveStudents.length })`;
  } else {
    button.textContent = "Inactive Students";
  }
}
/* =====================================================
   AWAY BUTTON
===================================================== */
function updateAwayButton() {
  const button = document.getElementById("awayHomeBtn");
  if (!button) {
    return;
  }
  const count = batches.reduce((sum, b) => sum + b.students.filter(s => s.away).length, 0);
  button.textContent = count ? `Temporarily Away (${ count })` : "Temporarily Away";
}
