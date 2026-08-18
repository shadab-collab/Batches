/* =====================================================
   OPEN / CLOSE
===================================================== */
function openCleanupPage() {
  document.getElementById("studentProfilePage").style.display = "none";
  document.getElementById("dashboardPage").style.display = "none";
  document.getElementById("overlay").style.display = "none";
  document.getElementById("profileOverlay").style.display = "none";
  document.querySelector(".header").style.display = "none";
  document.getElementById("batchGrid").style.display = "none";
  const inactiveWrap = document.querySelector(".inactive-home-wrap");
  if (inactiveWrap) {
    inactiveWrap.style.display = "none";
  }
  document.getElementById("cleanupPage").style.display = "block";
  window.scrollTo(0, 0);

  loadOrphanedData();
}

function closeCleanupPage() {
  document.getElementById("cleanupPage").style.display = "none";
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
   LOAD ORPHANED DATA
===================================================== */
async function loadOrphanedData() {
  const box = document.getElementById("cleanupResults");
  box.innerHTML = `<div class="empty">लोड हो रहा है...</div>`;

  const validOwners = collectAllKnownFeeOwners();

  try {
    const res = await fetch("/api/fees/orphaned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ validOwners })
    });
    const data = await res.json();

    if (!data.success) {
      box.innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }

    if (!data.orphaned.length) {
      box.innerHTML = `<div class="empty">कोई Orphaned Data नहीं मिला — सब साफ़ है।</div>`;
      return;
    }

    box.innerHTML = data.orphaned.map((o, i) => `
            <div class="dashboard-card">
                <div class="dashboard-card-title">
                    ${ o.possibleName ? escapeHtml(o.possibleName) : "(नाम पता नहीं)" }
                    <span class="empty" style="display:inline;"> — ${ o.ownerType === "family" ? "Family" : "Student" } · ${ escapeHtml(o.ownerKey) }</span>
                </div>
                <div class="dashboard-row"><span>कुल Paid</span><strong>₹${ o.totalPaid }</strong></div>
                <div class="dashboard-row"><span>कुल Charity</span><strong>₹${ o.totalCharity }</strong></div>
                <div class="dashboard-row"><span>Fee Cycles</span><strong>${ o.cycleCount }</strong></div>
                <div class="dashboard-row"><span>Receipts</span><strong>${ o.receiptCount }</strong></div>
                <div class="dashboard-row"><span>आख़िरी गतिविधि</span><strong>${ o.lastActivity ? FeeUtils.formatDDMM(o.lastActivity) : "-" }</strong></div>

                <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;">
                    <input type="checkbox" id="cleanupPurgeReceipts${ i }">
                    Receipts भी हमेशा के लिए हटाएं (${ o.receiptCount } मिलीं)
                </label>

                <div class="fee-actions">
                    <button class="btn-danger" onclick="purgeOrphanedOwner('${ o.ownerType }','${ escapeHtml(o.ownerKey) }', ${ i })">
                        हमेशा के लिए हटाएं
                    </button>
                </div>
            </div>
        `).join("");

  } catch (error) {
    box.innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}


/* =====================================================
   PURGE ONE OWNER (irreversible)
===================================================== */
async function purgeOrphanedOwner(ownerType, ownerKey, index) {
  const purgeReceipts = document.getElementById(`cleanupPurgeReceipts${ index }`).checked;

  const confirmMsg = `"${ ownerKey }" का सारा Fee/Payment Data हमेशा के लिए मिटाना है`
    + (purgeReceipts ? ", साथ में उसकी सारी Receipts भी" : " (Receipts को छोड़कर)")
    + `।\n\nये वापस नहीं होगा। पक्का करना है?`;

  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    const res = await fetch("/api/fees/purge-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerType, ownerKey, purgeReceipts })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Delete नहीं हो सका");
      return;
    }
    loadOrphanedData();
  } catch (error) {
    alert("Delete नहीं हो सका। इंटरनेट चेक करें।");
  }
}
