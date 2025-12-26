const passwordInput = document.getElementById("password");
const meterFill = document.querySelector(".meter-fill");
const result = document.getElementById("result");

// ---------- Strength (zxcvbn) ----------
passwordInput.addEventListener("input", () => {
    const pw = passwordInput.value;

    if (!pw) {
        meterFill.style.width = "0%";
        result.textContent = "Enter a password";
        return;
    }

    const r = zxcvbn(pw);
    const score = r.score; // 0..4
    const percent = [10, 30, 55, 80, 100][score];

    meterFill.style.width = `${percent}%`;
    result.textContent = strengthLabel(score, r);
});

function strengthLabel(score, r) {
    const labels = [
        "Very weak ❌",
        "Weak 😬",
        "Fair 🙂",
        "Good ✅",
        "Strong 💪",
    ];
    const warning = r.feedback?.warning ? ` | ${r.feedback.warning}` : "";
    return `${labels[score]}${warning}`;
}
