let feeStatusCache = {};
let feeStatusFetchInFlight = false;
let feeStatusLastFetchedAt = 0;

const FEE_STATUS_UNPAID_SHADES = [
  "#e57373", // this-cycle unpaid (lightest)
  "#e53935",
  "#c62828",
  "#a01515",
  "#7a0f10",
  "#4d0a0a" // capped darkest, for very long unpaid streaks
];
const FEE_STATUS_PAID_COLOR = "#1e8e3e";


/* =====================================================
   COLLECT OWNER KEYS FROM CURRENTLY LOADED DATA
===================================================== */
function collectFeeOwnersFromBatches() {
  const seen = new Set();
  const owners = [];

  batches.forEach(batch => {
    batch.students.forEach(student => {
      const ownerType = student.familyCode ? "family" : "student";
      const ownerKey = student.familyCode || student.id;
      const dedupeKey = `${ ownerType }:${ ownerKey }`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        owners.push({ ownerType, ownerKey });
      }
    });
  });

  return owners;
}


/* =====================================================
   REFRESH + APPLY
   Debounced — safe to call from render() without spamming
   the network on every small UI action.
===================================================== */
async function refreshFeeStatusCache(force) {
  if (feeStatusFetchInFlight) {
    return;
  }
  const now = Date.now();
  if (!force && now - feeStatusLastFetchedAt < 5000) {
    applyFeeStatusColors();
    return;
  }

  const owners = collectFeeOwnersFromBatches();
  if (!owners.length) {
    return;
  }

  feeStatusFetchInFlight = true;
  try {
    const res = await fetch("/api/fees/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owners })
    });
    const data = await res.json();
    if (data.success) {
      feeStatusCache = data.statuses || {};
      feeStatusLastFetchedAt = Date.now();
      applyFeeStatusColors();
    }
  } catch (error) {
    // silent — colour-coding is a visual nicety, not critical path
  } finally {
    feeStatusFetchInFlight = false;
  }
}

function colorForStatus(entry) {
  if (!entry) {
    return "";
  }
  if (entry.status === "paid") {
    return FEE_STATUS_PAID_COLOR;
  }
  const tier = Math.min(entry.streak, FEE_STATUS_UNPAID_SHADES.length) - 1;
  return FEE_STATUS_UNPAID_SHADES[Math.max(0, tier)];
}

function applyFeeStatusColors() {
  document.querySelectorAll("[data-owner-key]").forEach(el => {
    const ownerType = el.dataset.ownerType;
    const ownerKey = el.dataset.ownerKey;
    const entry = feeStatusCache[`${ ownerType }:${ ownerKey }`];
    const color = colorForStatus(entry);
    el.style.color = color || "";
  });
}
