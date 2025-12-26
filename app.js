const passwordInput = document.getElementById("password");
const meterFill = document.querySelector(".meter-fill");

const strengthBadge = document.getElementById("strengthBadge");
const crackTimeEl = document.getElementById("crackTime");
const suggestionsEl = document.getElementById("suggestions");

const hibpText = document.getElementById("hibpText");
const hibpStatus = document.getElementById("hibpStatus");

const toggleBtn = document.getElementById("toggle-visibility");

// ---------- Toggle visibility ----------
toggleBtn.addEventListener("click", () => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    toggleBtn.textContent = hidden ? "🙈" : "👁️";
});

// ---------- Strength (zxcvbn) + Auto HIBP ----------
passwordInput.addEventListener("input", () => {
    const pw = passwordInput.value;

    if (!pw) {
        meterFill.style.width = "0%";
        renderStrengthEmpty();
        renderHIBP("neutral", "Not checked yet");
        return;
    }

    const r = zxcvbn(pw); // score 0..4
    const score = r.score;
    const percent = [10, 30, 55, 80, 100][score];

    meterFill.style.width = `${percent}%`;
    renderStrength(score, r);

    scheduleHIBPCheck(pw);
});

function renderStrengthEmpty() {
    strengthBadge.textContent = "—";
    strengthBadge.className = "badge neutral";
    crackTimeEl.textContent = "—";
    suggestionsEl.innerHTML = "";

    const li = document.createElement("li");
    li.textContent = "Type a password to see feedback.";
    suggestionsEl.appendChild(li);
}

function renderStrength(score, r) {
    const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
    const emojis = ["❌", "😬", "🙂", "✅", "💪"];

    strengthBadge.textContent = `${labels[score]} ${emojis[score]}`;
    strengthBadge.className =
        "badge " + (score <= 1 ? "bad" : score === 2 ? "mid" : "good");

    // crack time (pick one of zxcvbn's display fields)
    const ct =
        r.crack_times_display?.offline_fast_hashing_1e10_per_second || "—";
    crackTimeEl.textContent = ct;

    // Suggestions list
    suggestionsEl.innerHTML = "";
    const items = [];

    if (r.feedback?.warning) items.push(r.feedback.warning);
    if (Array.isArray(r.feedback?.suggestions))
        items.push(...r.feedback.suggestions);

    if (items.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Looks good.";
        suggestionsEl.appendChild(li);
        return;
    }

    for (const t of items.slice(0, 6)) {
        const li = document.createElement("li");
        li.textContent = t;
        suggestionsEl.appendChild(li);
    }
}

// ---------- HIBP Auto Check ----------
const DEBOUNCE_MS = 700;
let hibpTimer = null;
let currentAbort = null;

// Cache: prefix -> Map(suffix -> count)
const rangeCache = new Map();

function scheduleHIBPCheck(pw) {
    // avoid checking extremely short inputs
    if (pw.length < 6) {
        renderHIBP("neutral", "Type at least 6 characters to check.");
        return;
    }

    if (hibpTimer) clearTimeout(hibpTimer);

    hibpTimer = setTimeout(async () => {
        if (currentAbort) currentAbort.abort();
        currentAbort = new AbortController();

        renderHIBP("neutral", "Checking HIBP…");

        try {
            const count = await checkPwnedPassword(pw, currentAbort.signal);
            if (count > 0) {
                renderHIBP(
                    "bad",
                    `Found in breaches (${count.toLocaleString()} times)`
                );
            } else {
                renderHIBP("ok", "Not found in HIBP database");
            }
        } catch (err) {
            if (String(err).includes("AbortError")) return;
            renderHIBP("neutral", `Error: ${String(err)}`);
        }
    }, DEBOUNCE_MS);
}

function renderHIBP(state, text) {
    hibpText.textContent = text;

    if (state === "bad") {
        hibpStatus.textContent = "Pwned";
        hibpStatus.className = "pill bad";
    } else if (state === "ok") {
        hibpStatus.textContent = "Safe";
        hibpStatus.className = "pill ok";
    } else {
        hibpStatus.textContent = "…";
        hibpStatus.className = "pill neutral";
    }
}

// ---------- HIBP Range API (k-anonymity) ----------
async function checkPwnedPassword(password, abortSignal) {
    const sha1 = await sha1Hex(password); // uppercase hex
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const cached = rangeCache.get(prefix);
    if (cached && cached.has(suffix)) return cached.get(suffix);

    const url = `https://api.pwnedpasswords.com/range/${prefix}`;
    const res = await fetch(url, {
        method: "GET",
        headers: { "Add-Padding": "true" },
        signal: abortSignal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const map = new Map();

    for (const line of text.split("\n")) {
        const t = line.trim();
        if (!t) continue;

        const [hashSuffix, countStr] = t.split(":");
        if (!hashSuffix || !countStr) continue;

        const count = parseInt(countStr, 10);
        map.set(hashSuffix.toUpperCase(), Number.isFinite(count) ? count : 0);
    }

    rangeCache.set(prefix, map);
    return map.get(suffix) ?? 0;
}

async function sha1Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const digest = await crypto.subtle.digest("SHA-1", data);
    return [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
}

// init state
renderStrengthEmpty();
renderHIBP("neutral", "Not checked yet");

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
