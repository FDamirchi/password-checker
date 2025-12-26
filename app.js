const passwordInput = document.getElementById("password");
const meterFill = document.querySelector(".meter-fill");

const strengthBadge = document.getElementById("strengthBadge");
const crackTimeEl = document.getElementById("crackTime");
const suggestionsEl = document.getElementById("suggestions");

const hibpText = document.getElementById("hibpText");
const hibpStatus = document.getElementById("hibpStatus");

const toggleBtn = document.getElementById("toggle-visibility");
const genBtn = document.getElementById("genBtn");
const copyBtn = document.getElementById("copyBtn");
const toastEl = document.getElementById("toast");

const themeBtn = document.getElementById("themeBtn");
const helpBtn = document.getElementById("helpBtn");
const helpOverlay = document.getElementById("helpOverlay");
const helpClose = document.getElementById("helpClose");
const helpOk = document.getElementById("helpOk");
const yearEl = document.getElementById("year");

// ---------- Helpers ----------
function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => {
        toastEl.classList.remove("show");
        toastEl.textContent = "";
    }, 1400);
}

function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
}

function randomFrom(chars, n) {
    const arr = new Uint32Array(n);
    crypto.getRandomValues(arr);
    let out = "";
    for (let i = 0; i < n; i++) out += chars[arr[i] % chars.length];
    return out;
}

function shuffleString(s) {
    const a = s.split("");
    const rnd = new Uint32Array(a.length);
    crypto.getRandomValues(rnd);
    for (let i = a.length - 1; i > 0; i--) {
        const j = rnd[i] % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a.join("");
}

function pick(arr, salt = 0) {
    const rnd = new Uint32Array(1);
    crypto.getRandomValues(rnd);
    return arr[(rnd[0] + salt) % arr.length];
}

// ---------- Theme (animated) ----------
if (yearEl) yearEl.textContent = new Date().getFullYear();

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
}

function toggleThemeAnimated() {
    document.documentElement.classList.add("theme-anim");

    const current =
        document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");

    window.clearTimeout(toggleThemeAnimated._t);
    toggleThemeAnimated._t = window.setTimeout(() => {
        document.documentElement.classList.remove("theme-anim");
    }, 320);
}

const savedTheme = localStorage.getItem("theme");
setTheme(savedTheme || "dark");
themeBtn?.addEventListener("click", toggleThemeAnimated);

// ---------- Help modal ----------
function openHelp() {
    helpOverlay.classList.add("open");
    helpOverlay.setAttribute("aria-hidden", "false");
}
function closeHelp() {
    helpOverlay.classList.remove("open");
    helpOverlay.setAttribute("aria-hidden", "true");
}

helpBtn?.addEventListener("click", openHelp);
helpClose?.addEventListener("click", closeHelp);
helpOk?.addEventListener("click", closeHelp);
helpOverlay?.addEventListener("click", (e) => {
    if (e.target === helpOverlay) closeHelp();
});
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && helpOverlay.classList.contains("open"))
        closeHelp();
});

// ---------- Toggle visibility ----------
toggleBtn.addEventListener("click", () => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    toggleBtn.textContent = hidden ? "🙈" : "👁️";
});

// ---------- Strength + Auto HIBP ----------
passwordInput.addEventListener("input", () => {
    const pw = passwordInput.value;

    if (!pw) {
        meterFill.style.width = "0%";
        renderStrengthEmpty();
        renderHIBP("neutral", "Not checked yet");
        return;
    }

    const r = zxcvbn(pw);
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

    strengthBadge.classList.remove("bump");
    void strengthBadge.offsetWidth;
    strengthBadge.classList.add("bump");

    crackTimeEl.textContent =
        r.crack_times_display?.offline_fast_hashing_1e10_per_second || "—";

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

// ---------- HIBP ----------
const DEBOUNCE_MS = 700;
let hibpTimer = null;
let currentAbort = null;
const rangeCache = new Map();

function scheduleHIBPCheck(pw) {
    if (pw.length < 6) {
        renderHIBP("neutral", "Type at least 6 characters to check.");
        return;
    }

    if (hibpTimer) clearTimeout(hibpTimer);

    hibpTimer = setTimeout(async () => {
        if (currentAbort) currentAbort.abort();
        currentAbort = new AbortController();

        renderHIBP("checking", "Checking HIBP…");

        try {
            const count = await checkPwnedPassword(pw, currentAbort.signal);
            if (count > 0)
                renderHIBP(
                    "bad",
                    `Found in breaches (${count.toLocaleString()} times)`
                );
            else renderHIBP("ok", "Not found in HIBP database");
        } catch (err) {
            if (String(err).includes("AbortError")) return;
            renderHIBP("neutral", `Error: ${String(err)}`);
        }
    }, DEBOUNCE_MS);
}

function renderHIBP(state, text) {
    hibpText.textContent = text;

    if (state === "checking") {
        hibpStatus.textContent = "Checking…";
        hibpStatus.className = "pill neutral loading";
        return;
    }

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

async function checkPwnedPassword(password, abortSignal) {
    const sha1 = await sha1Hex(password);
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

// ---------- Copy (button morph to Copied!) ----------
// IMPORTANT: no toast("Copied.") here, only button animation.
copyBtn.addEventListener("click", async () => {
    const pw = passwordInput.value;
    if (!pw) return toast("Nothing to copy.");

    const originalText = copyBtn.textContent;

    try {
        await navigator.clipboard.writeText(pw);
        animateCopied(copyBtn, originalText);
    } catch {
        passwordInput.focus();
        passwordInput.select();
        const ok = document.execCommand("copy");
        if (ok) animateCopied(copyBtn, originalText);
        else toast("Copy failed.");
    }
});

function animateCopied(btn, originalText) {
    btn.classList.add("copied");
    btn.textContent = "✅ Copied!";

    window.clearTimeout(animateCopied._t);
    animateCopied._t = window.setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = originalText;
    }, 1100);
}

// ---------- Smart Generator ----------
genBtn.addEventListener("click", () => {
    const base = passwordInput.value || "";
    const generated = generateStrongerPasswordSmart(base);

    passwordInput.value = generated;
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));

    passwordInput.focus();
    passwordInput.select();
    toast("Generated a stronger similar password.");
});

function generateStrongerPasswordSmart(base) {
    const targetScore = 3;
    const attempts = 30;

    const baseClean = (base || "").trim();
    const targetLen = clamp(Math.max(14, baseClean.length + 4), 14, 28);

    let best = "";
    let bestScore = -1;
    let bestGuesses = Infinity;

    for (let i = 0; i < attempts; i++) {
        const candidate = buildCandidateFromBase(baseClean, targetLen, i);
        if (candidate === baseClean) continue;

        const r = zxcvbn(candidate);
        const score = r.score;
        const guesses = r.guesses ?? 1e18;

        if (
            score > bestScore ||
            (score === bestScore && guesses < bestGuesses)
        ) {
            best = candidate;
            bestScore = score;
            bestGuesses = guesses;
        }
        if (score >= targetScore) return candidate;
    }

    return best || strongRandom(16);
}

function buildCandidateFromBase(base, targetLen, salt) {
    const words = (base.match(/[A-Za-z]+/g) || []).filter((w) => w.length >= 3);
    const digits = (base.match(/\d+/g) || []).join("");
    const syms = (base.match(/[^A-Za-z0-9]/g) || []).join("");

    let core = "";
    if (words.length > 0) {
        const w1 = words[0];
        const w2 = words.length > 1 ? words[words.length - 1] : "";
        core =
            stylizeWord(w1, salt) + (w2 ? "-" + stylizeWord(w2, salt + 1) : "");
    } else if (base) {
        core = base.slice(0, Math.min(6, base.length));
    } else {
        core = "safe";
    }

    const sep = pick(["-", "_", ".", "~"], salt);
    const sym = syms
        ? syms[0]
        : pick(["!", "@", "#", "$", "%", "&", "*"], salt + 2);

    const dLen = clamp(digits.length || 2, 2, 6);
    const newDigits = mutateDigits(digits, dLen, salt + 3);

    const headUpper = randomFrom("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 1);
    const tailLower = randomFrom("abcdefghijklmnopqrstuvwxyz", 2);

    let pw = `${headUpper}${core}${sep}${newDigits}${sym}${tailLower}`;

    while (pw.length < targetLen) {
        pw += sep + pronounceableChunk(3 + (salt % 3));
    }

    if (pw.length > targetLen) pw = pw.slice(0, targetLen);
    pw = pw.slice(0, 2) + shuffleString(pw.slice(2));
    return pw;
}

function stylizeWord(w, salt) {
    const map = { a: "4", e: "3", i: "1", o: "0", s: "$", t: "7" };
    let out = "";
    for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        const low = ch.toLowerCase();
        const useLeet = (i + salt) % 5 === 0;
        out +=
            useLeet && map[low] ? map[low] : i === 0 ? ch.toUpperCase() : low;
    }
    return out;
}

function mutateDigits(orig, len, salt) {
    if (orig && orig.length > 0) {
        const base = orig.slice(0, len).padEnd(len, "0");
        let out = "";
        for (let i = 0; i < len; i++) {
            const d = base.charCodeAt(i) - 48;
            const add = (salt + i * 3) % 10;
            out += String((d + add) % 10);
        }
        return out;
    }
    return randomFrom("0123456789", len);
}

function pronounceableChunk(n) {
    const vowels = "aeiou";
    const cons = "bcdfghjklmnpqrstvwxyz";
    const chooseUpper = randomFrom("01", 1) === "1";

    let s = "";
    for (let i = 0; i < n; i++) {
        s += i % 2 === 0 ? randomFrom(cons, 1) : randomFrom(vowels, 1);
    }
    return chooseUpper ? s[0].toUpperCase() + s.slice(1) : s;
}

function strongRandom(n) {
    const mix =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.?";
    return randomFrom(mix, n);
}

// init
renderStrengthEmpty();
renderHIBP("neutral", "Not checked yet");
