// --- CONFIGURATION ---
const GAME_VERSION = "1.0"; 
const START_DATE = new Date(2026, 3, 30); // March 30, 2026

// Encoded Word Database (Date Index : Base64 Word)
const WORD_DATABASE = {
    0: "Q1JPU1M=", // Day 1: CROSS
    1: "U1RBSU4=", // Day 2: STAIN
    2: "Q09DQ0k=", // Day 3: COCCI
    3: "QkxBU1Q=", // Day 4: BLAST
    4: "U0VSVU0=", // Day 5: SERUM
    5: "U01FQVI=", // Day 6: SMEAR
    6: "UExBVEU="  // Day 7: PLATE
};

const LAB_DICTIONARY = [
    "BLAST", "SMEAR", "COAGS", "EOSIN", "SICKL", "PLATE", "CYTES", "HEMES",
    "SERUM", "LIPID", "ANION", "URINE", "ASSAY", "TITRE", "PANEL", "RENAL", "LIVER",
    "COCCI", "AGARS", "STAIN", "GRAMS", "YEAST", "FUNGI", "VIRUS", "SPORE", "MEDIA", 
    "HYPHA", "PRION", "SWABS", "PETRI", "VIBRIO", "SLIDE", "FIXES", "MOUNT", "BLOCK", 
    "CELLS", "FIBRE", "ORGAN", "HEART", "CROSS", "BLOOD", "GROUP", "DONOR", "SALIN", 
    "UNITS", "REAGS", "TYPED", "RHNEG", "RHPOS", "ELISA", "NAATS", "WHMIS", "POCTS", 
    "CSFS", "LISYS", "STATS", "PHIAL", "LYSES", "AGREE", "VALVE", "TUBES"
];

// --- GAME STATE ---
let validWords = new Set();
const dayIndex = Math.floor((new Date() - START_DATE) / (1000 * 60 * 60 * 24));
const targetWord = WORD_DATABASE[dayIndex] ? atob(WORD_DATABASE[dayIndex]) : "DONE";

let currentGuess = "";
let guesses = [];
let gameOver = false;
let keyStates = {};

// --- INITIALIZATION ---
async function loadDictionary() {
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

function initBoard() {
    const container = document.getElementById('game-container');
    document.getElementById('day-number').innerText = dayIndex + 1;

    if (targetWord === "DONE") {
        container.innerHTML = "<h2 style='text-align:center'>Challenge Complete!<br>Check back later.</h2>";
        return;
    }

    // Create 6 rows
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.id = `row-${i}`;
        for (let j = 0; j < 5; j++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = `tile-${i}-${j}`;
            row.appendChild(tile);
        }
        container.appendChild(row);
    }

    // Load saved progress for the current day
    const saved = JSON.parse(localStorage.getItem(`bcit_wordle_${dayIndex}`));
    if (saved) {
        guesses = saved.guesses;
        gameOver = saved.gameOver;
        keyStates = saved.keyStates || {};
        guesses.forEach((g, i) => revealWord(g, i, false));
        for (const [key, state] of Object.entries(keyStates)) {
            const keyEl = document.querySelector(`.key[data-key="${key}"]`);
            if (keyEl) keyEl.setAttribute('data-state', state);
        }
        if (gameOver) setTimeout(showModal, 500);
    }
}

// --- GAMEPLAY LOGIC ---
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

function updateBoard() {
    const rowIdx = guesses.length;
    if (rowIdx > 5) return;
    for (let j = 0; j < 5; j++) {
        const tile = document.getElementById(`tile-${rowIdx}-${j}`);
        tile.innerText = currentGuess[j] || "";
        tile.style.borderColor = currentGuess[j] ? "#565758" : "";
    }
}

function submitGuess() {
    if (!validWords.has(currentGuess)) {
        showToast("Not in word list");
        const currentRow = document.getElementById(`row-${guesses.length}`);
        currentRow.classList.add('shake');
        setTimeout(() => currentRow.classList.remove('shake'), 500);
        return;
    }

    const guessToSubmit = currentGuess;
    guesses.push(guessToSubmit);
    revealWord(guessToSubmit, guesses.length - 1, true);
    
    if (guessToSubmit === targetWord || guesses.length === 6) {
        gameOver = true;
        setTimeout(showModal, 1000);
    }

    currentGuess = "";
    localStorage.setItem(`bcit_wordle_${dayIndex}`, JSON.stringify({guesses, gameOver, keyStates}));
}

function revealWord(guess, rowIdx, shouldAnimate) {
    const rowTiles = Array.from({length: 5}, (_, j) => document.getElementById(`tile-${rowIdx}-${j}`));
    let tempTarget = targetWord.split('');

    // First pass: Find Green (Correct)
    guess.split('').forEach((letter, i) => {
        rowTiles[i].innerText = letter;
        if (letter === targetWord[i]) {
            rowTiles[i].setAttribute('data-state', 'correct');
            updateKeyboard(letter, 'correct');
            tempTarget[i] = null;
        }
    });

    // Second pass: Find Yellow (Present) or Gray (Absent)
    guess.split('').forEach((letter, i) => {
        if (rowTiles[i].getAttribute('data-state')) return;
        const idx = tempTarget.indexOf(letter);
        if (idx !== -1) {
            rowTiles[i].setAttribute('data-state', 'present');
            updateKeyboard(letter, 'present');
            tempTarget[idx] = null;
        } else {
            rowTiles[i].setAttribute('data-state', 'absent');
            updateKeyboard(letter, 'absent');
        }
    });
}

function updateKeyboard(letter, state) {
    const keyEl = document.querySelector(`.key[data-key="${letter}"]`);
    if (!keyEl) return;
    
    const currentState = keyStates[letter];
    if (currentState === 'correct') return; 
    if (currentState === 'present' && state === 'absent') return;

    keyStates[letter] = state;
    keyEl.setAttribute('data-state', state);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2000);
}

function showModal() {
    const win = guesses[guesses.length - 1] === targetWord;
    document.getElementById('modal-title').innerText = win ? "Genius!" : "Hard Luck!";
    document.getElementById('modal-msg').innerText = win ? `Solved in ${guesses.length}/6` : `The word was ${targetWord}`;
    document.getElementById('modal').style.display = 'block';
}

async function share() {
    let grid = `BCIT MedLab Wordle Day ${dayIndex + 1} (${guesses.length}/6)\n`;
    guesses.forEach(g => {
        let rowStates = new Array(5).fill('⬛');
        let tempTarget = targetWord.split('');
        g.split('').forEach((l, i) => { if (l === targetWord[i]) { rowStates[i] = '🟩'; tempTarget[i] = null; } });
        g.split('').forEach((l, i) => {
            if (rowStates[i] !== '🟩') {
                let idx = tempTarget.indexOf(l);
                if (idx !== -1) { rowStates[i] = '🟨'; tempTarget[idx] = null; }
            }
        });
        grid += rowStates.join('') + "\n";
    });

    if (navigator.share) {
        await navigator.share({ text: grid });
    } else {
        navigator.clipboard.writeText(grid);
        alert("Copied results to clipboard!");
    }
}

// Event Listeners
window.addEventListener('keydown', (e) => handleKey(e.key.toUpperCase()));
loadDictionary().then(initBoard);
