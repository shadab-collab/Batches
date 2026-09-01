let monthlyListText = "";

function formatOwnerLines(owner, prefix) {
  const codeSuffix = owner.monthCodes.length ? ` {${ owner.monthCodes.join(" ") }}` : "";
  return owner.members.map(m => {
    const displayName = (m.listCodeName && m.listCodeName.trim()) ? m.listCodeName : m.name;
    return `${ prefix } ${ displayName.toUpperCase() }${ codeSuffix }`;
  }).join("\n");
}

function buildMonthlyListText(data) {
  const lines = [];

  data.due01.forEach(owner => lines.push(formatOwnerLines(owner, "01")));
  data.due15.forEach(owner => lines.push(formatOwnerLines(owner, "15")));
  data.noProfile.forEach(owner => lines.push(formatOwnerLines({ ...owner, monthCodes: [] }, "00")));

  return lines.join("\n");
}

async function openMonthlyListModal() {
  document.getElementById("monthlyListBody").innerHTML = `<div class="empty">लोड हो रहा है...</div>`;
  document.getElementById("monthlyListOverlay").style.display = "flex";

  try {
    const res = await fetch("/api/fees/monthly-list");
    const data = await res.json();
    if (!data.success) {
      document.getElementById("monthlyListBody").innerHTML = `<div class="empty">${ escapeHtml(data.message || "Error") }</div>`;
      return;
    }

    monthlyListText = buildMonthlyListText(data);

    document.getElementById("monthlyListBody").innerHTML = `
        <textarea id="monthlyListTextarea" readonly rows="18" style="width:100%;font-family:monospace;font-size:13px;padding:10px;border:1px solid #ddd;border-radius:8px;">${ escapeHtml(monthlyListText) }</textarea>
        <div class="empty" style="margin-top:8px;">यह list आपके सारे Active Students से, Fee due-date और Family के हिसाब से अपने आप बनी है — Pending Months भी असली Fee data से निकाले गए हैं।</div>
    `;
  } catch (error) {
    document.getElementById("monthlyListBody").innerHTML = `<div class="empty">Load नहीं हो सका। इंटरनेट चेक करें।</div>`;
  }
}

function closeMonthlyListModal() {
  document.getElementById("monthlyListOverlay").style.display = "none";
}

async function copyMonthlyListText() {
  try {
    await navigator.clipboard.writeText(monthlyListText);
    alert("Copy हो गया — अब अपने Doc में Paste कर लें।");
  } catch (error) {
    const textarea = document.getElementById("monthlyListTextarea");
    if (textarea) {
      textarea.select();
      document.execCommand("copy");
      alert("Copy हो गया — अब अपने Doc में Paste कर लें।");
    } else {
      alert("Copy नहीं हो सका — Text को manually select करके Copy करें।");
    }
  }
}
