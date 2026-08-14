const defaultBatches = [
    {name:"Batch 1",time:"",students:[]},
    {name:"Batch 2",time:"",students:[]},
    {name:"Batch 3",time:"",students:[]},
    {name:"Batch 4",time:"",students:[]},
    {name:"Batch 5",time:"",students:[]},

    {name:"Batch 6",time:"14:30",students:[
        "Sana","Yusra","Sidra","Sarim","Sariha","Ryaan",
        "Zishan","Arif","Aaquib","Saif","Saad","Aasifa",
        "Affan","Almas"
    ]},

    {name:"Batch 7",time:"15:30",students:[
        "Atif","Kasif","asad","Sajid","Wajid","Ayaan",
        "Ayaan","fatima","Zohra","Eeram","piyush","Zaid"
    ]},

    {name:"Batch 8",time:"16:30",students:[
        "Imran","Sumaiya","Sohail","Arshad","Kasif",
        "Abhiraaz","Arisfa","Misty","Rishiraaz","Arham",
        "Talib","Tausif","GuFran","Neha","Khadija"
    ]},

    {name:"Batch 9",time:"17:30",students:[
        "Surbhi","Minsa","Sadiya","Saif","Mariya","Yusuf",
        "Rehan","Adil","Zikra","Sayra","Samya","Nurfiya",
        "Aamna","Ruhani"
    ]},

    {name:"Batch 10",time:"18:30",students:[
        "Yusuf","Alsaba","Atif","Harish","Arfa","Ayaan",
        "Almas","Salman","Aman","Aadil","Raunak","Raushan",
        "Arshalan","Samreen","Mahreen"
    ]}
];


const DATA_VERSION = "2";

let batches;


if(localStorage.getItem("batchManagerDataVersion") !== DATA_VERSION){

    batches = defaultBatches;

    localStorage.setItem(
        "batchManagerDataVersion",
        DATA_VERSION
    );

    localStorage.setItem(
        "batchManagerData",
        JSON.stringify(batches)
    );

}else{

    batches =
        JSON.parse(
            localStorage.getItem("batchManagerData")
        ) || defaultBatches;

}


let currentBatch = null;


function saveData(){

    localStorage.setItem(
        "batchManagerData",
        JSON.stringify(batches)
    );

    if(
        window.API_MODE &&
        typeof saveBatchesToServer === "function"
    ){
        saveBatchesToServer();
    }

}


function renderBatches(){

    const container =
        document.getElementById("batchesContainer");

    if(!container) return;

    container.innerHTML = "";

    batches.forEach((batch,index)=>{

        const card =
            document.createElement("div");

        card.className = "batch-card";

        card.innerHTML = `

            <div class="batch-header">

                <div
                    class="batch-name"
                    onclick="openBatch(${index})"
                >
                    ${batch.name}
                </div>

                <div
                    class="batch-time"
                    onclick="editBatchTime(${index})"
                >
                    ${batch.time || "Time set करें"}
                </div>

            </div>

            <div class="student-count">
                ${batch.students.length} Students
            </div>

            <button
                class="manage-btn"
                onclick="openBatch(${index})"
            >
                Manage Students
            </button>

        `;

        container.appendChild(card);

    });

}


function openBatch(index){

    currentBatch = index;

    const batch = batches[index];

    const title =
        document.getElementById("studentPageTitle");

    if(title){
        title.textContent =
            batch.name;
    }

    renderStudents();

    const page =
        document.getElementById("studentPage");

    if(page){
        page.classList.add("active");
    }

}


function closeStudentPage(){

    const page =
        document.getElementById("studentPage");

    if(page){
        page.classList.remove("active");
    }

    currentBatch = null;

}


function renderStudents(){

    if(currentBatch === null) return;

    const batch =
        batches[currentBatch];

    const list =
        document.getElementById("studentList");

    if(!list) return;

    list.innerHTML = "";

    batch.students.forEach((student,index)=>{

        const row =
            document.createElement("div");

        row.className =
            "student-row";

        row.innerHTML = `

            <div class="student-number">
                ${index + 1}
            </div>

            <div
                class="student-name"
                onclick="openStudentProfile(${index})"
            >
                ${student}
            </div>

            <button
                class="student-edit-btn"
                onclick="editStudent(${index})"
            >
                Edit
            </button>

            <button
                class="student-delete-btn"
                onclick="deleteStudent(${index})"
            >
                Delete
            </button>

        `;

        list.appendChild(row);

    });

}


function addStudent(){

    if(currentBatch === null) return;

    const input =
        document.getElementById("newStudentName");

    if(!input) return;

    const name =
        input.value.trim();

    if(!name) return;

    batches[currentBatch].students.push(name);

    input.value = "";

    saveData();

    renderStudents();

    renderBatches();

}


function editStudent(index){

    if(currentBatch === null) return;

    const oldName =
        batches[currentBatch].students[index];

    const newName =
        prompt("Student name:",oldName);

    if(newName === null) return;

    const name =
        newName.trim();

    if(!name) return;

    batches[currentBatch].students[index] =
        name;

    saveData();

    renderStudents();

    renderBatches();

}


function deleteStudent(index){

    if(currentBatch === null) return;

    if(
        !confirm(
            "क्या आप इस Student को हटाना चाहते हैं?"
        )
    ){
        return;
    }

    batches[currentBatch].students.splice(
        index,
        1
    );

    saveData();

    renderStudents();

    renderBatches();

}


function editBatchTime(index){

    const batch =
        batches[index];

    const time =
        prompt(
            "Batch Time:",
            batch.time || ""
        );

    if(time === null) return;

    batch.time =
        time.trim();

    saveData();

    renderBatches();

}


function openStudentProfile(index){

    if(currentBatch === null) return;

    const student =
        batches[currentBatch].students[index];

    const profilePage =
        document.getElementById(
            "studentProfilePage"
        );

    if(!profilePage) return;

    const profileName =
        document.getElementById(
            "profileStudentName"
        );

    if(profileName){
        profileName.textContent =
            student;
    }

    profilePage.classList.add("active");

}


function closeStudentProfile(){

    const profilePage =
        document.getElementById(
            "studentProfilePage"
        );

    if(profilePage){
        profilePage.classList.remove("active");
    }

}


document.addEventListener(
    "DOMContentLoaded",
    function(){

        renderBatches();

        const addBtn =
            document.getElementById(
                "addStudentBtn"
            );

        if(addBtn){

            addBtn.addEventListener(
                "click",
                addStudent
            );

        }

    }
);
function renderStudents() {
    
    const list =
        document.getElementById("studentList");
    
    list.innerHTML = "";
    
    const students =
        batches[currentBatch].students;
    
    students.forEach((student, index) => {
        
        const row =
            document.createElement("div");
        
        row.className = "student-row";
        
        row.innerHTML = `

            <span class="student-serial">
                ${index + 1}.
            </span>

            <span class="student-row-name">
                ${escapeHtml(student)}
            </span>

            <button
                class="edit-student"
                onclick="editStudent(${index})"
            >
                Edit
            </button>

            <button
                class="delete-student"
                onclick="deleteStudent(${index})"
            >
                Delete
            </button>

        `;
        
        list.appendChild(row);
        
    });
    
}


function saveBatch() {
    
    if (currentBatch === null) return;
    
    const name =
        document.getElementById("batchName").value.trim();
    
    const time =
        document.getElementById("batchTime").value;
    
    if (name) {
        
        batches[currentBatch].name =
            name;
        
    }
    
    batches[currentBatch].time =
        time;
    
    saveData();
    
    render();
    
    closeOverlay();
    
}


function addStudent() {
    
    if (currentBatch === null) return;
    
    const input =
        document.getElementById("newStudent");
    
    const name =
        input.value.trim();
    
    if (!name) return;
    
    batches[currentBatch].students.push(
        name
    );
    
    input.value = "";
    
    saveData();
    
    renderStudents();
    
    render();
    
}


function editStudent(index) {
    
    if (currentBatch === null) return;
    
    const oldName =
        batches[currentBatch].students[index];
    
    const newName =
        prompt(
            "Student का नाम बदलें:",
            oldName
        );
    
    if (newName === null) return;
    
    const name =
        newName.trim();
    
    if (!name) return;
    
    batches[currentBatch].students[index] =
        name;
    
    saveData();
    
    renderStudents();
    
    render();
    
}


function deleteStudent(index) {
    
    if (currentBatch === null) return;
    
    const student =
        batches[currentBatch].students[index];
    
    const ok =
        confirm(
            `"${student}" को Delete करना है?`
        );
    
    if (!ok) return;
    
    batches[currentBatch].students.splice(
        index,
        1
    );
    
    saveData();
    
    renderStudents();
    
    render();
    
}


function closeOverlay() {
    
    document.getElementById("overlay").style.display =
        "none";
    
    currentBatch = null;
    
}


function openStudentProfile(
    batchIndex,
    studentIndex
) {
    
    const student =
        batches[batchIndex].students[
            studentIndex
        ];
    
    document.getElementById(
            "profileStudentName"
        ).textContent =
        student;
    
    document.getElementById(
            "profileBatch"
        ).textContent =
        batches[batchIndex].name;
    
    document.getElementById(
            "profilePage"
        ).style.display =
        "block";
    
}


function closeStudentProfile() {
    
    document.getElementById(
            "profilePage"
        ).style.display =
        "none";
    
}


function escapeHtml(value) {
    
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    
}


document.addEventListener(
    "DOMContentLoaded",
    () => {
        
        render();
        
        const saveBtn =
            document.getElementById(
                "saveBatch"
            );
        
        if (saveBtn) {
            
            saveBtn.onclick =
                saveBatch;
            
        }
        
        const addBtn =
            document.getElementById(
                "addStudentBtn"
            );
        
        if (addBtn) {
            
            addBtn.onclick =
                addStudent;
            
        }
        
    }
);
function render() {
    
    renderBatches();
    
    if (currentBatch !== null) {
        renderStudents();
    }
    
}


function renderBatches() {
    
    const container =
        document.getElementById(
            "batchesContainer"
        );
    
    if (!container) return;
    
    container.innerHTML = "";
    
    batches.forEach(
        (batch, index) => {
            
            const card =
                document.createElement("div");
            
            card.className =
                "batch-card";
            
            card.innerHTML = `

                <div class="batch-title">
                    ${escapeHtml(batch.name)}
                </div>

                <div
                    class="batch-time"
                    onclick="editBatchTime(${index})"
                >
                    ${escapeHtml(
                        batch.time || "Time"
                    )}
                </div>

                <div class="batch-student-count">
                    ${batch.students.length}
                    Students
                </div>

                <button
                    onclick="openBatch(${index})"
                >
                    Manage Students
                </button>

            `;
            
            container.appendChild(card);
            
        }
    );
    
}


function openBatch(index) {
    
    currentBatch =
        index;
    
    const batch =
        batches[index];
    
    const title =
        document.getElementById(
            "studentPageTitle"
        );
    
    if (title) {
        
        title.textContent =
            batch.name;
        
    }
    
    renderStudents();
    
    const page =
        document.getElementById(
            "studentPage"
        );
    
    if (page) {
        
        page.style.display =
            "block";
        
    }
    
}


function closeStudentPage() {
    
    const page =
        document.getElementById(
            "studentPage"
        );
    
    if (page) {
        
        page.style.display =
            "none";
        
    }
    
    currentBatch =
        null;
    
}


function editBatchTime(index) {
    
    const oldTime =
        batches[index].time || "";
    
    const newTime =
        prompt(
            "Batch का Time:",
            oldTime
        );
    
    if (newTime === null) {
        return;
    }
    
    batches[index].time =
        newTime.trim();
    
    saveData();
    
    render();
    
}


function moveStudent(
    fromBatch,
    studentIndex,
    toBatch
) {
    
    if (
        fromBatch === toBatch
    ) {
        
        return;
        
    }
    
    const student =
        batches[fromBatch]
        .students
        .splice(
            studentIndex,
            1
        )[0];
    
    if (!student) {
        return;
    }
    
    batches[toBatch]
        .students
        .push(student);
    
    saveData();
    
    render();
    
}


function openMoveStudent(index) {
    
    if (currentBatch === null) {
        return;
    }
    
    const student =
        batches[currentBatch]
        .students[index];
    
    if (!student) {
        return;
    }
    
    let options = "";
    
    batches.forEach(
        (batch, batchIndex) => {
            
            if (
                batchIndex !==
                currentBatch
            ) {
                
                options +=
                    `${batchIndex + 1}. ${batch.name}\n`;
                
            }
            
        }
    );
    
    const answer =
        prompt(
            `Student: ${student}\n\n` +
            `किस Batch में भेजना है?\n\n` +
            options
        );
    
    if (answer === null) {
        return;
    }
    
    const selected =
        parseInt(answer, 10) - 1;
    
    if (
        Number.isNaN(selected) ||
        selected < 0 ||
        selected >= batches.length ||
        selected === currentBatch
    ) {
        
        alert("Invalid Batch");
        
        return;
        
    }
    
    moveStudent(
        currentBatch,
        index,
        selected
    );
    
}
function initStudentProfileFamily() {
    
    const familyStatus =
        document.getElementById(
            "profileFamilyStatus"
        );
    
    const familyActions =
        document.getElementById(
            "profileFamilyActions"
        );
    
    if (!familyStatus || !familyActions) {
        return;
    }
    
    familyStatus.textContent =
        "Solo";
    
    familyActions.innerHTML = `

        <button
            type="button"
            onclick="addStudentToFamily()"
        >
            Add to Family
        </button>

        <button
            type="button"
            onclick="removeStudentFromFamily()"
        >
            Remove from Family
        </button>

    `;
    
}


function addStudentToFamily() {
    
    const familyCode =
        prompt(
            "Family Code डालें:"
        );
    
    if (familyCode === null) {
        return;
    }
    
    const code =
        familyCode.trim();
    
    if (!code) {
        return;
    }
    
    const status =
        document.getElementById(
            "profileFamilyStatus"
        );
    
    if (status) {
        
        status.textContent =
            "Family";
        
    }
    
    alert(
        "Student को Family में add कर दिया गया।"
    );
    
}


function removeStudentFromFamily() {
    
    const ok =
        confirm(
            "क्या इस Student को Family से remove करना है?"
        );
    
    if (!ok) {
        return;
    }
    
    const status =
        document.getElementById(
            "profileFamilyStatus"
        );
    
    if (status) {
        
        status.textContent =
            "Solo";
        
    }
    
}


function saveFamilyData() {
    
    saveData();
    
}


window.addStudentToFamily =
    addStudentToFamily;

window.removeStudentFromFamily =
    removeStudentFromFamily;

window.openStudentProfile =
    openStudentProfile;

window.closeStudentProfile =
    closeStudentProfile;

window.openMoveStudent =
    openMoveStudent;

window.moveStudent =
    moveStudent;

window.addStudent =
    addStudent;

window.editStudent =
    editStudent;

window.deleteStudent =
    deleteStudent;

window.editBatchTime =
    editBatchTime;

window.openBatch =
    openBatch;

window.closeStudentPage =
    closeStudentPage;


document.addEventListener(
    "DOMContentLoaded",
    function() {
        
        initStudentProfileFamily();
        
        render();
        
    }
);