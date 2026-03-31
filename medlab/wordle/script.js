// --- CONFIGURATION (Managed via Config Tool) ---
const GAME_VERSION = "1.0"; 
const START_DATE = new Date(2026, 3, 30); // Local Time: March 30, 2026

// Encoded word list (Base64) to deter "Inspect Element" cheaters
// Format: Date Index : Encoded Word
const WORD_DATABASE = {
    0: "Q1JPU1M=", // CROSS
    1: "U1RBSU4=", // STAIN
    2: "Q09DQ0k=", // COCCI
    3: "QkxBU1Q=", // BLAST
    4: "U0VSVU0=", // SERUM
    // Add more here...
};

const LAB_DICTIONARY = ["BLAST", "SMEAR", "COAGS", "EOSIN", "ELISA", "WHMIS", "STATS"]; // Add your full list here
// ----------------------------------------------

let validWords = new Set();
const dayIndex = Math.floor((new Date() - START_DATE) / (1000 * 60 * 60 * 24));
const targetWord = WORD_DATABASE[dayIndex] ? atob(WORD_DATABASE[dayIndex]) : "DONE";

let currentGuess = "";
let guesses = [];
let gameOver = false;
const keyStates = {}; // Tracks keyboard colors

async function loadDictionary() {
    // Check version to clear old storage if you updated the game logic
    if (localStorage.getItem('game_version') !== GAME_VERSION) {
        localStorage.clear();
        localStorage.setItem('game_version', GAME_VERSION);
    }

    try {
        const resp = await fetch('https://raw.githubusercontent.com/charlesreid1/five-letter-words/master/sgb-words.txt');
        const text = await resp.text();
        validWords = new Set(text.toUpperCase().split('\n').map(w => w.trim()));
        LAB_DICTIONARY.forEach(w => validWords.add(w.toUpperCase()));
    } catch (e) {
        validWords = new Set([...LAB_DICTIONARY]);
    }
}

function handleKey(key) {
    if (gameOver || targetWord === "DONE") return;
    if (key === "ENTER") {
        if (currentGuess.length === 5) submitGuess();
    } else if (key === "BACKSPACE" || key === "⌫") {
        currentGuess = currentGuess.slice(0, -1);
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
        currentGuess += key;
    }
    updateBoard();
}

function submitGuess() {
    if (!validWords.has(currentGuess)) {
        showToast("Not in word list");
        return;
    }
    guesses.push(currentGuess);
    revealWord(currentGuess, guesses.length - 1);
    
    if (currentGuess === targetWord || guesses.length === 6) {
        gameOver = true;
        setTimeout(showModal, 1000);
    }
    saveProgress();
    currentGuess = "";
}

function revealWord(guess, rowIdx) {
    const rowTiles = Array.from({length: 5}, (_, j) => document.getElementById(`tile-${rowIdx}-${j}`));
    let tempTarget = targetWord.split('');

    // First pass: Green
    guess.split('').forEach((l, i) => {
        if (l === targetWord[i]) {
            rowTiles[i].setAttribute('data-state', 'correct');
            updateKeyboard(l, 'correct');
            tempTarget[i] = null;
        }
    });

    // Second pass: Yellow/Gray
    guess.split('').forEach((l, i) => {
        if (rowTiles[i].getAttribute('data-state')) return;
        const idx = tempTarget.indexOf(l);
        if (idx !== -1) {
            rowTiles[i].setAttribute('data-state', 'present');
            updateKeyboard(l, 'present');
            tempTarget[idx] = null;
        } else {
            rowTiles[i].setAttribute('data-state', 'absent');
            updateKeyboard(l, 'absent');
        }
    });
}

function updateKeyboard(letter, state) {
    const keyEl = document.querySelector(`.key[data-key="${letter}"]`);
    if (!keyEl) return;
    
    const currentState = keyStates[letter];
    if (currentState === 'correct') return; // Green stays green
    if (currentState === 'present' && state === 'absent') return; // Yellow stays yellow

    keyStates[letter] = state;
    keyEl.setAttribute('data-state', state);
}

function saveProgress() {
    localStorage.setItem(`bcit_wordle_${dayIndex}`, JSON.stringify({guesses, gameOver, keyStates}));
}

// ... include initBoard, updateBoard, showModal, share functions from previous code ...
