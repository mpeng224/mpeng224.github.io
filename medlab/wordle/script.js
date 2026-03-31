const GAME_VERSION = "1.1.0";
const START_DATE = new Date(2026, 2, 30); // March 30, 2026
const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

// Base64 Encoded MedLab Words from PRD
const ENCODED_DATABASE = [
    "QkxBU1Q=", "U01FQVI=", "Q09BR1M=", "RU9TSU4=", "U0lDS0w=", "UExBVEU=", "Q1lURVM=", "SEVNRVM=", "U0VSVU0=", "TElQSUQ=",
    "QU5JT04=", "VVJJTkU=", "QVNTQVk=", "VElUUkU=", "UEFORUw=", "UkVOQUw=", "TElWRVI=", "Q09DQ0k=", "QUdBUlM=", "U1RBSU4=",
    "R1JBTVM=", "WUVBU1Q=", "RlVOR0k=", "VklSVVM=", "U1BPUkU=", "TUVESUE=", "SFlQSEE=", "UFJJT04=", "U1dBQlM=", "UEVUUkk=",
    "VklCUklP", "U0xJREU=", "RklYRVU=", "TU9VTlQ=", "QkxPQ0s=", "Q0VMTFM=", "RklCUkU=", "T1JHQU4=", "SEVBUlQ=", "Q1JPU1M=",
    "QkxPT0Q=", "R1JPVVA=", "RE9OT1I=", "U0FMSU4=", "VU5JVFM=", "UkVBR1M=", "VFlQRUQ=", "UkhORUc=", "UkhQT1M=", "RUxJU0E=",
    "TkFBVFM=", "V0hNSVM=", "UE9DVFM=", "Q1NGUw==", "TElTWVM=", "U1RBVFM="
];

let targetWord = "";
let currentGuess = "";
let guesses = [];
let gameOver = false;
let validWords = new Set();

async function initGame() {
    // 1. Version Check & LocalStorage
    if (localStorage.getItem("medlab_version") !== GAME_VERSION) {
        localStorage.clear();
        localStorage.setItem("medlab_version", GAME_VERSION);
    }

    // 2. Fetch Global Dictionary for validation
    try {
        const response = await fetch('https://raw.githubusercontent.com/charlesreid1/five-letter-words/master/sgb-words.txt');
        const text = await response.text();
        validWords = new Set(text.split('\n').map(w => w.trim().toUpperCase()));
    } catch (e) {
        console.error("Dictionary fetch failed, using fallback.");
    }

    // 3. Add MedLab words to validation set
    const medWords = ENCODED_DATABASE.map(w => atob(w).toUpperCase());
    medWords.forEach(w => validWords.add(w));

    // 4. Calculate Daily Word
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayIndex = Math.floor((today - START_DATE) / (1000 * 60 * 60 * 24));
    targetWord = medWords[dayIndex % medWords.length];

    // 5. Load Progress
    const saved = JSON.parse(localStorage.getItem(`medlab_save_${dayIndex}`));
    if (saved) {
        guesses = saved.guesses;
        gameOver = saved.gameOver;
        renderSavedGame();
    }

    setupUI();
}

function setupUI() {
    const board = document.getElementById("board");
    board.innerHTML = "";
    for (let i = 0; i < MAX_GUESSES; i++) {
        const row = document.createElement("div");
        row.className = "row";
        for (let j = 0; j < WORD_LENGTH; j++) {
            const tile = document.createElement("div");
            tile.className = "tile";
            tile.id = `tile-${i}-${j}`;
            row.appendChild(tile);
        }
        board.appendChild(row);
    }

    const keyboard = document.getElementById("keyboard");
    const layout = [["Q","W","E","R","T","Y","U","I","O","P"], ["A","S","D","F","G","H","J","K","L"], ["ENTER","Z","X","C","V","B","N","M","⌫"]];
    layout.forEach(rowArr => {
        const row = document.createElement("div");
        row.className = "key-row";
        rowArr.forEach(key => {
            const btn = document.createElement("button");
            btn.textContent = key;
            btn.className = "key" + (key.length > 1 ? " large" : "");
            btn.onclick = () => handleInput(key);
            btn.id = `key-${key}`;
            row.appendChild(btn);
        });
        keyboard.appendChild(row);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleInput("ENTER");
        else if (e.key === "Backspace") handleInput("⌫");
        else if (/^[a-zA-Z]$/.test(e.key)) handleInput(e.key.toUpperCase());
    });
}

function handleInput(key) {
    if (gameOver) return;

    if (key === "ENTER") {
        submitGuess();
    } else if (key === "⌫") {
        currentGuess = currentGuess.slice(0, -1);
        updateBoard();
    } else if (currentGuess.length < WORD_LENGTH) {
        currentGuess += key;
        updateBoard();
    }
}

function submitGuess() {
    if (currentGuess.length !== WORD_LENGTH) return showToast("Not enough letters");
    if (!validWords.has(currentGuess)) return showToast("Not in word list");

    const rowIdx = guesses.length;
    guesses.push(currentGuess);
    const result = evaluate(currentGuess);
    animateRow(rowIdx, result);
    
    if (currentGuess === targetWord || guesses.length === MAX_GUESSES) {
        gameOver = true;
        setTimeout(() => showStats(currentGuess === targetWord), 1500);
    }

    saveProgress();
    currentGuess = "";
}

function evaluate(guess) {
    const result = Array(WORD_LENGTH).fill("absent");
    const targetArr = targetWord.split("");
    const guessArr = guess.split("");

    // Correct spots
    guessArr.forEach((letter, i) => {
        if (letter === targetArr[i]) {
            result[i] = "correct";
            targetArr[i] = null;
        }
    });

    // Present spots
    guessArr.forEach((letter, i) => {
        if (result[i] !== "correct" && targetArr.includes(letter)) {
            result[i] = "present";
            targetArr[targetArr.indexOf(letter)] = null;
        }
    });
    return result;
}

function animateRow(rowIdx, result) {
    result.forEach((state, i) => {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        const key = document.getElementById(`key-${guesses[rowIdx][i]}`);
        setTimeout(() => {
            tile.classList.add(state);
            if (!key.classList.contains("correct")) {
                key.classList.remove("present");
                key.classList.add(state);
            }
        }, i * 100);
    });
}

function updateBoard() {
    const rowIdx = guesses.length;
    for (let i = 0; i < WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        tile.textContent = currentGuess[i] || "";
        tile.setAttribute("data-state", currentGuess[i] ? "toggled" : "");
    }
}

function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function saveProgress() {
    const dayIndex = Math.floor((new Date() - START_DATE) / (1000 * 60 * 60 * 24));
    localStorage.setItem(`medlab_save_${dayIndex}`, JSON.stringify({ guesses, gameOver }));
}

function renderSavedGame() {
    setTimeout(() => {
        guesses.forEach((guess, i) => animateRow(i, evaluate(guess)));
    }, 100);
}

initGame();
