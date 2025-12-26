# 🔐 Password Checker

A sleek, privacy-first password toolkit for the web — built with vanilla JS.

✅ **Strength estimation** using **zxcvbn**  
✅ **Breach exposure check** via **Have I Been Pwned (Pwned Passwords Range API)** using **k-anonymity**  
✅ **Smart generator** that creates a stronger password with a similar “vibe”  

> **Client-side only.** No passwords are stored. Nothing is sent in plaintext.

---

## 🌐 Live Demo
- https://FDamirchi.github.io/password-checker/

---

## ✨ What it does

### 🧠 Strength (zxcvbn)
- Uses zxcvbn’s **score (0..4)** and **feedback**
- Displays **suggestions** (why it’s weak + how to improve)
- Shows **estimated crack time** and a smooth strength meter

### 🧬 Breach check (HIBP Range API)
- Hashes the password locally using **SHA-1** (Web Crypto API)
- Sends only the **first 5 characters** of the hash prefix (**k-anonymity**)
- Compares the returned suffixes locally and reports:
  - **Not found** (good sign)
  - **Pwned** with the number of occurrences (bad sign)

> Important: “Not found” ≠ “strong”. It only means it didn’t appear in the known HIBP dataset.

### 🪄 Smart password generator
- Generates multiple candidates based on the input’s **structure**
  (words/digits/symbol vibe)
- Scores candidates using **zxcvbn** and selects a **stronger** option
- Designed to avoid purely random, unrelated outputs

---

## 🧰 Tech Stack
- **HTML / CSS / Vanilla JavaScript**
- **zxcvbn** (CDN)
- **Web Crypto API** (`SubtleCrypto.digest` for SHA-1)
- **HIBP Pwned Passwords Range API**

---

## 🛡️ Privacy & Security Notes
- No server. No database. No analytics.
- Passwords never leave your browser in plaintext.
- HIBP queries use **k-anonymity** (hash prefix only).

---

## ▶️ Run locally
Just open `index.html` in your browser.

> Tip: for testing (and to avoid caching issues), you can also run a tiny server:
```bash
python3 -m http.server 5500
