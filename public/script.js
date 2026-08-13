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


function formatTime(t){

    if(!t) return "Time Set";

    const [h,m] = t.split(":");

    let hour = Number(h);

    const ampm =
        hour >= 12
            ? "PM"
            : "AM";

    hour =
        hour % 12 || 12;

    return `${hour}:${m} ${ampm}`;

}


function render(){

    const grid =
        document.getElementById("batchGrid");

    grid.innerHTML = "";


    batches.forEach((batch,index)=>{

        const box =
            document.createElement("div");

        box.className = "batch";

        box.onclick =
            () => openBatch(index);


        let students =
            batch.students.map((s,i) =>

                `<div class="student">

                    <span class="serial">
                        ${i+1}.
                    </span>

                    <button
                        class="student-name"
                        onclick="
                            event.stopPropagation();
                            openStudentProfile(${index},${i})
                        "
                    >
                        ${escapeHtml(s)}
                    </button>

                </div>`

            ).join("");


        if(!students){

            students =
                `<div class="empty">
                    कोई Student नहीं
                </div>`;

        }


        box.innerHTML = `

            <div class="batch-head">

                <div class="batch-name">
                    ${escapeHtml(batch.name)}
                </div>

                <div class="batch-time">
                    ${formatTime(batch.time)}
                </div>

            </div>

            <div class="students">
                ${students}
            </div>

        `;


        grid.appendChild(box);

    });

}


function openBatch(index){

    currentBatch = index;

    const b = batches[index];


    document.getElementById("modalTitle").textContent =
        b.name + " Manage";


    document.getElementById("batchName").value =
        b.name;


    document.getElementById("batchTime").value =
        b.time;


    document.getElementById("newStudent").value =
        "";


    renderStudents();


    document.getElementById("overlay").style.display =
        "flex";

}


function closeModal(){

    document.getElementById("overlay").style.display =
        "none";

    currentBatch = null;

    render();

}


function saveBatch(){

    if(currentBatch === null) return;


    const name =
        document
            .getElementById("batchName")
            .value
            .trim();


    const time =
        document
            .getElementById("batchTime")
            .value;


    if(name)
        batches[currentBatch].name = name;


    batches[currentBatch].time = time;


    saveData();

    closeModal();

}
function addStudent() {
  
  if (currentBatch === null) return;
  
  
  const input =
    document.getElementById("newStudent");
  
  
  const name =
    input.value.trim();
  
  
  if (!name) return;
  
  
  batches[currentBatch].students.push(name);
  
  
  input.value = "";
  
  
  saveData();
  
  
  renderStudents();
  
  
  render();
  
}


function deleteStudent(index) {
  
  if (currentBatch === null) return;
  
  
  batches[currentBatch].students.splice(
    index,
    1
  );
  
  
  saveData();
  
  
  renderStudents();
  
  
  render();
  
}


function moveStudent(index) {
  
  if (currentBatch === null) return;
  
  
  const student =
    batches[currentBatch].students[index];
  
  
  const target =
    prompt(
      
      `Student: ${student}\n\n` +
      
      `किस Batch में Move करना है?\n\n` +
      
      batches
      
      .map((b, i) =>
        
        i === currentBatch ?
        "" :
        `${i+1}. ${b.name} — ${formatTime(b.time)}`
        
      )
      
      .filter(Boolean)
      
      .join("\n") +
      
      `\n\nBatch number लिखें (1-10):`
      
    );
  
  
  if (target === null) return;
  
  
  const targetIndex =
    Number(target) - 1;
  
  
  if (
    
    !Number.isInteger(targetIndex) ||
    
    targetIndex < 0 ||
    
    targetIndex >= batches.length ||
    
    targetIndex === currentBatch
    
  ) {
    
    alert("सही Batch number चुनें।");
    
    return;
    
  }
  
  
  batches[targetIndex].students.push(
    student
  );
  
  
  batches[currentBatch].students.splice(
    index,
    1
  );
  
  
  saveData();
  
  
  renderStudents();
  
  
  render();
  
}


function renderStudents() {
  
  const list =
    document.getElementById("studentList");
  
  
  const students =
    batches[currentBatch].students;
  
  
  if (!students.length) {
    
    list.innerHTML =
      `<div class="empty">
                कोई Student नहीं
            </div>`;
    
    return;
    
  }
  
  
  list.innerHTML =
    
    students.map((s, i) => `

            <div class="student-row">

                <div class="serial-manage">
                    ${i+1}.
                </div>


                <button
                    class="manage-student-name"
                    onclick="
                        openStudentProfile(
                            ${currentBatch},
                            ${i}
                        )
                    "
                >
                    ${escapeHtml(s)}
                </button>


                <button
                    class="small-btn btn-light"
                    onclick="moveUp(${i})"
                    ${i === 0 ? "disabled" : ""}
                >
                    ↑
                </button>


                <button
                    class="small-btn btn-light"
                    onclick="moveDown(${i})"
                    ${i === students.length - 1 ? "disabled" : ""}
                >
                    ↓
                </button>


                <button
                    class="small-btn btn-main"
                    onclick="moveStudent(${i})"
                >
                    Move
                </button>


                <button
                    class="small-btn btn-danger"
                    onclick="deleteStudent(${i})"
                >
                    Delete
                </button>

            </div>

        `).join("");
  
}


function moveUp(index) {
  
  if (
    currentBatch === null ||
    index <= 0
  ) {
    return;
  }
  
  
  const a =
    batches[currentBatch].students;
  
  
  [
    a[index - 1],
    a[index]
  ] = [
    a[index],
    a[index - 1]
  ];
  
  
  saveData();
  
  
  renderStudents();
  
  
  render();
  
}


function moveDown(index) {
  
  if (currentBatch === null) return;
  
  
  const a =
    batches[currentBatch].students;
  
  
  if (index >= a.length - 1) return;
  
  
  [
    a[index],
    a[index + 1]
  ] = [
    a[index + 1],
    a[index]
  ];
  
  
  saveData();
  
  
  renderStudents();
  
  
  render();
  
}
let profileBatchIndex = null;
let profileStudentIndex = null;


function openStudentProfile(bi, si){

    profileBatchIndex = bi;
    profileStudentIndex = si;

    const b = batches[bi];


    document.getElementById("pageStudentName").textContent =
        b.students[si];


    document.getElementById("pageStudentBatch").textContent =
        b.name;


    document.getElementById("pageStudentTime").textContent =
        formatTime(b.time);


    document.getElementById("pageStudentPosition").textContent =
        si + 1;


    document.getElementById("overlay").style.display =
        "none";


    document.getElementById("profileOverlay").style.display =
        "none";


    document.querySelector(".header").style.display =
        "none";


    document.getElementById("batchGrid").style.display =
        "none";


    document.getElementById("studentProfilePage").style.display =
        "block";


    window.scrollTo(0,0);

}


function closeStudentProfilePage(){

    document.getElementById("studentProfilePage").style.display =
        "none";


    document.querySelector(".header").style.display =
        "";


    document.getElementById("batchGrid").style.display =
        "";


    profileBatchIndex = null;
    profileStudentIndex = null;


    window.scrollTo(0,0);

}


function closeStudentProfile(){

    closeStudentProfilePage();

}


function saveStudentProfile(){

    if(profileBatchIndex === null) return;


    const name =
        document
            .getElementById("profileStudentName")
            .value
            .trim();


    if(!name){

        alert(
            "Student का नाम खाली नहीं हो सकता।"
        );

        return;

    }


    batches[
        profileBatchIndex
    ].students[
        profileStudentIndex
    ] = name;


    saveData();


    closeStudentProfilePage();


    render();

}


function escapeHtml(text){

    return String(text)

        .replaceAll("&","&amp;")

        .replaceAll("<","&lt;")

        .replaceAll(">","&gt;")

        .replaceAll('"',"&quot;")

        .replaceAll("'","&#039;");

}


document
    .getElementById("overlay")
    .addEventListener("click", e => {

        if(e.target.id === "overlay"){

            closeModal();

        }

    });


document
    .getElementById("profileOverlay")
    .addEventListener("click", e => {

        if(e.target.id === "profileOverlay"){

            closeStudentProfile();

        }

    });


render();


/* =====================================================
   MONGODB / API
===================================================== */

window.API_MODE = true;


async function loadBatchesFromServer(){

    try{

        const response =
            await fetch("/api/batches");


        if(!response.ok){

            throw new Error(
                "API error"
            );

        }


        const data =
            await response.json();


        /*
          MongoDB खाली है तो पहले
          localStorage वाला data save होगा।
        */

        if(!Array.isArray(data.batches)){

            const localRaw =
                localStorage.getItem(
                    "batchManagerData"
                );


            if(localRaw){

                try{

                    const localBatches =
                        JSON.parse(localRaw);


                    if(
                        Array.isArray(localBatches) &&
                        localBatches.length
                    ){

                        batches =
                            localBatches;


                        const migrated =
                            await saveBatchesToServer();


                        render();


                        return migrated;

                    }

                }catch(e){

                    console.warn(
                        "Local migration data could not be read.",
                        e
                    );

                }

            }


            render();

            return true;

        }


        /*
          MongoDB में data मौजूद है,
          इसलिए MongoDB को source of truth माना जाएगा।
        */

        batches =
            data.batches;


        localStorage.setItem(
            "batchManagerData",
            JSON.stringify(batches)
        );


        render();


        return true;


    }catch(error){

        console.warn(
            "MongoDB API unavailable; using local browser data.",
            error
        );


        return false;

    }

}


async function saveBatchesToServer(){

    try{

        const response =
            await fetch(
                "/api/batches",
                {
                    method:"PUT",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:JSON.stringify({
                        batches
                    })

                }
            );


        if(!response.ok){

            throw new Error(
                "Save failed"
            );

        }


        localStorage.setItem(
            "batchManagerData",
            JSON.stringify(batches)
        );


        return true;


    }catch(error){

        console.warn(
            "Could not save to MongoDB API.",
            error
        );


        /*
          API fail होने पर भी
          local backup रहेगा।
        */

        localStorage.setItem(
            "batchManagerData",
            JSON.stringify(batches)
        );


        return false;

    }

}


window.addEventListener(
    "load",
    async () => {

        await loadBatchesFromServer();

    }
);