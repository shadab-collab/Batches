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