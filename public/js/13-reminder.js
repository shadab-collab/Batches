let reminderOwner = null;
let generatedReminderBlob = null;


/* =====================================================
   OPEN REMINDER FORM (from the fee card)
===================================================== */
function openReminderModal() {
  const owner = currentFeeOwner;
  const student = currentFeeStudent;
  reminderOwner = owner;
  generatedReminderBlob = null;

  const unpaidCycles = (currentFeeData.cycles || []).filter(c => c.remaining > 0);
  if (!unpaidCycles.length) {
    alert("कोई बकाया Cycle नहीं है");
    return;
  }

  let names = [student.name];
  if (owner.ownerType === "family") {
    const members = getFamilyMembers(owner.ownerKey);
    if (members.length) {
      names = members.map(m => m.student.name);
    }
  }

  document.getElementById("reminderModalBody").innerHTML = `
        <div class="field">
            <label>नाम (comma से अलग करें)</label>
            <input id="rmNamesInput" type="text" value="${ escapeHtml(names.join(", ")) }" oninput="previewReminder()">
        </div>
        <div class="empty" id="reminderPreview" style="text-align:left;"></div>
    `;

  document.getElementById("reminderModalActions").innerHTML = `
        <button class="btn-main" onclick="generateReminder()">Reminder Generate करें</button>
        <button class="btn-light" onclick="closeReminderModal()">Close</button>
    `;

  document.getElementById("reminderOverlay").style.display = "flex";
  previewReminder();
}

function buildReminderParts() {
  const namesInput = document.getElementById("rmNamesInput").value;
  const names = namesInput.split(",").map(s => s.trim()).filter(Boolean);
  const unpaidCycles = (currentFeeData.cycles || []).filter(c => c.remaining > 0);

  const namesText = FeeUtils.joinHindiList(names);
  const datesText = FeeUtils.joinHindiList(unpaidCycles.map(c => FeeUtils.formatHindiDateShort(c.dueDate)));
  const monthCount = unpaidCycles.length;
  const monthsText = names.length === 1 ? `${ monthCount } माह` : `${ monthCount }-${ monthCount } माह`;
  const collective = FeeUtils.hindiCollectiveWord(names.length);

  return { namesText, datesText, monthsText, collective };
}

function previewReminder() {
  const { namesText, datesText, monthsText, collective } = buildReminderParts();
  document.getElementById("reminderPreview").textContent =
    `${ namesText } का ${ datesText } को महीना लग गया है, इस प्रकार ${ collective } कुल ${ monthsText } का फीस बाकी है। कृपया इसे जल्द से जल्द क्लियर करने का कष्ट करें।`;
}


/* =====================================================
   GENERATE: fill the template + capture as HD image
===================================================== */
async function generateReminder() {
  const { namesText, datesText, monthsText, collective } = buildReminderParts();

  document.getElementById("rmNames").textContent = namesText;
  document.getElementById("rmDates").textContent = datesText;
  document.getElementById("rmMonths").textContent = monthsText;
  document.getElementById("rmCollective").textContent = collective;

  const modalBody = document.getElementById("reminderModalBody");
  modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Image बन रही है...</div></div>`;
  document.getElementById("reminderModalActions").innerHTML = `
        <button class="btn-light" onclick="closeReminderModal()">Close</button>
    `;

  try {
    const el = document.getElementById("reminderTemplate");
    const rect = el.getBoundingClientRect();
    const longerEdge = Math.max(rect.width, rect.height);
    const scale = Math.min(4, Math.max(2, 1920 / longerEdge));

    const canvas = await html2canvas(el, {
      backgroundColor: "#fbfbfb",
      scale,
      useCORS: true,
      letterRendering: true
    });
    canvas.toBlob(blob => {
      generatedReminderBlob = blob;
      showReminderPreview(blob);
    }, "image/png");
  } catch (error) {
    modalBody.innerHTML = `<div class="receipt-search-result"><div class="empty">Image नहीं बन सकी। इंटरनेट/browser चेक करें।</div></div>`;
  }
}

function showReminderPreview(blob) {
  const url = URL.createObjectURL(blob);
  document.getElementById("reminderModalBody").innerHTML = `
        <div class="receipt-search-result">
            <img class="receipt-preview-img" src="${ url }">
            <div class="receipt-share-actions">
                <a class="btn-main" download="Fee-Reminder.png" href="${ url }">Download</a>
                <button class="btn-light" onclick="shareReminderImage()">Share</button>
            </div>
        </div>
    `;
  document.getElementById("reminderModalActions").innerHTML = `
        <button class="btn-light" onclick="closeReminderModal()">Close</button>
    `;
}

async function shareReminderImage() {
  if (!generatedReminderBlob) {
    return;
  }
  const file = new File([generatedReminderBlob], "Fee-Reminder.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Fee Reminder" });
    } catch (error) {
      // user cancelled — nothing to do
    }
  } else {
    alert("इस डिवाइस/browser पर सीधे Share उपलब्ध नहीं है। Download करके WhatsApp पर भेजें।");
  }
}

function closeReminderModal() {
  document.getElementById("reminderOverlay").style.display = "none";
}
