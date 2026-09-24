/* =====================================================
   TO-DO PAGE — open / close
===================================================== */
function openTodoPage() {
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
  const awayPageEl = document.getElementById("awayStudentsPage");
  if (awayPageEl) {
    awayPageEl.style.display = "none";
  }
  document.getElementById("todoPage").style.display = "block";
  populateTodoStudentSelect();
  renderTodos();
  window.scrollTo(0, 0);
}

function closeTodoPage() {
  document.getElementById("todoPage").style.display = "none";
  document.querySelector(".header").style.display = "";
  document.getElementById("batchGrid").style.display = "";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "";
  }
  render();
  window.scrollTo(0, 0);
}

function onTodoTargetChange() {
  const type = document.getElementById("todoTargetSelect").value;
  document.getElementById("todoStudentPickRow").style.display = type === "student" ? "" : "none";
}
/* =====================================================
   STUDENT PICKER — every Active + Inactive + Away student,
   so a To-Do can be tied to any of them
===================================================== */
function populateTodoStudentSelect() {
  const select = document.getElementById("todoStudentSelect");
  if (!select) {
    return;
  }
  const options = [];
  batches.forEach(batch => {
    batch.students.forEach(s => {
      options.push({ id: s.id, label: `${ s.name }${ s.away ? " (Away)" : "" } — ${ batch.name }` });
    });
  });
  inactiveStudents.forEach(s => {
    options.push({ id: s.id, label: `${ s.name } (Inactive)` });
  });
  select.innerHTML = options.map(o => `<option value="${ escapeHtml(o.id) }">${ escapeHtml(o.label) }</option>`).join("");
}
/* =====================================================
   ADD / TOGGLE / DELETE
===================================================== */
function addTodo() {
  const textInput = document.getElementById("todoTextInput");
  const text = textInput.value.trim();
  if (!text) {
    alert("To-Do में कुछ लिखें");
    return;
  }
  const targetType = document.getElementById("todoTargetSelect").value;
  let targetStudentId = "";
  let targetStudentName = "";
  if (targetType === "student") {
    const select = document.getElementById("todoStudentSelect");
    targetStudentId = select.value;
    targetStudentName = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : "";
    if (!targetStudentId) {
      alert("कोई Student चुनें");
      return;
    }
  }
  todos.push({
    id: "T-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    text,
    targetType,
    targetStudentId,
    targetStudentName,
    done: false,
    createdAt: FeeUtils.todayISO()
  });
  textInput.value = "";
  saveData();
  renderTodos();
  updateTodoBadge();
}

function toggleTodoDone(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    return;
  }
  todo.done = !todo.done;
  saveData();
  renderTodos();
  updateTodoBadge();
}

function deleteTodo(id) {
  const ok = confirm("इस To-Do को हमेशा के लिए हटाना है?");
  if (!ok) {
    return;
  }
  todos = todos.filter(t => t.id !== id);
  saveData();
  renderTodos();
  updateTodoBadge();
}
/* =====================================================
   RENDER
===================================================== */
function todoTagHtml(todo) {
  const label = (todo.targetType === "student" && todo.targetStudentName) ? todo.targetStudentName : "सबके लिए";
  return `<span style="font-size:11px;color:#888;">(${ escapeHtml(label) })</span> `;
}

function renderTodos() {
  const pendingEl = document.getElementById("todoPendingList");
  const doneEl = document.getElementById("todoDoneList");
  if (!pendingEl || !doneEl) {
    return;
  }

  const pending = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);

  pendingEl.innerHTML = pending.length
    ? pending.map(t => `
                <div class="dashboard-row">
                    <label style="display:flex;align-items:flex-start;gap:8px;flex:1;">
                        <input type="checkbox" onchange="toggleTodoDone('${ t.id }')" style="margin-top:4px;">
                        <span>${ todoTagHtml(t) }${ escapeHtml(t.text) }</span>
                    </label>
                    <button class="small-btn btn-danger" onclick="deleteTodo('${ t.id }')">हटाएं</button>
                </div>
            `).join("")
    : `<div class="empty">कोई To-Do बाकी नहीं है।</div>`;

  doneEl.innerHTML = done.length
    ? done.map(t => `
                <div class="dashboard-row" style="opacity:0.6;">
                    <label style="display:flex;align-items:flex-start;gap:8px;flex:1;">
                        <input type="checkbox" checked onchange="toggleTodoDone('${ t.id }')" style="margin-top:4px;">
                        <span style="text-decoration:line-through;">${ todoTagHtml(t) }${ escapeHtml(t.text) }</span>
                    </label>
                    <button class="small-btn btn-danger" onclick="deleteTodo('${ t.id }')">हटाएं</button>
                </div>
            `).join("")
    : `<div class="empty">अभी कोई To-Do पूरा नहीं हुआ।</div>`;
}
/* =====================================================
   HOME BUTTON BADGE — pending count, like a notification dot
===================================================== */
function updateTodoBadge() {
  const badge = document.getElementById("todoBadge");
  if (!badge) {
    return;
  }
  const count = todos.filter(t => !t.done).length;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "";
  } else {
    badge.style.display = "none";
  }
}
