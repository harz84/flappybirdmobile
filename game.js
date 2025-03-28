const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const restartButton = document.getElementById("restartButton");
const scoreDisplay = document.getElementById("finalScore");
const gameOverTextElement = document.getElementById("gameOverText");

const instructionsOverlay = document.getElementById("instructions");
const startButton = document.getElementById("startButton");

// Game Constants
const BASE_ASPECT_RATIO = 480 / 640;
const BIRD_WIDTH_RATIO = 0.125;
const BIRD_HEIGHT_RATIO = 0.0625;
const PIPE_WIDTH_RATIO = 0.1248;
const BASE_GRAVITY = 0.09072;
const BASE_LIFT = -2.1504;  // Reduced strength by 20% AGAIN from -2.688
const BASE_PIPE_SPEED = 0.5;
const BASE_PIPE_SPAWN_INTERVAL = 450;
// Spawn first pipe MUCH sooner (75% reduction from previous 315 -> 79)
const FIRST_PIPE_SPAWN_FRAME = 79;
const PIPE_GAP_RATIO = (1 / 3) * 0.75;
const DIFFICULTY_INCREASE_FACTOR = 1.10;
const MIN_PIPE_SPAWN_INTERVAL = 60;

let dimensions = { width: 0, height: 0 };
let pipeGap = 0;

const updateDimensions = () => {
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;

    // Calculate target dimensions based on aspect ratio, fitting within available space
    let targetHeight = availableHeight;
    let targetWidth = targetHeight * BASE_ASPECT_RATIO;

    // If calculated width is too wide, constrain by width and recalculate height
    if (targetWidth > availableWidth) {
        targetWidth = availableWidth;
        targetHeight = targetWidth / BASE_ASPECT_RATIO;
    }

    // This logic prioritizes aspect ratio. It will fill height only if width allows.
    dimensions.width = Math.floor(targetWidth);
    dimensions.height = Math.floor(targetHeight);

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Recalculate dynamic sizes
    pipeGap = dimensions.height * PIPE_GAP_RATIO;
    bird.width = dimensions.width * BIRD_WIDTH_RATIO;
    bird.height = dimensions.height * BIRD_HEIGHT_RATIO;
};


// Bird object
let bird = {
    x: 50,
    y: 150,
    width: 0,
    height: 0,
    gravity: BASE_GRAVITY,
    lift: BASE_LIFT, // Use the final adjusted base value
    velocity: 0
};

// Game State
let pipes = [];
let frameCount = 0;
let score = 0;
let gameOver = false;
let audioInitialized = false;
let gameStarted = false;
let pipeSpeed = BASE_PIPE_SPEED;
let pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL;
let animationId;

// Audio Elements (No changes needed)
const audioStart = new Audio('start.wav');
const audioJump = new Audio('jump.wav');
const audioScore = new Audio('score.wav');
const audioGameOver = new Audio('gameover.wav');
const audioSuccess = new Audio('success.mp3');
[audioStart, audioJump, audioScore, audioGameOver, audioSuccess].forEach(audio => {
    audio.preload = 'auto';
    audio.load();
});

let isStartPlaying = false;
let jumpQueue = false;

function playSound(audio) {
    audio.currentTime = 0;
    audio.play().catch(error => {
        if (!audioInitialized) {
             console.log("Audio interaction needed. Waiting for touch/key.", error.name);
             const initAudio = () => {
                 audioInitialized = true;
                 console.log("Audio context resumed by user interaction.");
                 audio.play().catch(err => console.log("Retry audio play failed: ", err));
                 document.removeEventListener('keydown', initAudio);
                 canvas.removeEventListener('touchstart', initAudio);
             };
             document.addEventListener('keydown', initAudio, { once: true });
             canvas.addEventListener('touchstart', initAudio, { once: true });
        } else {
             console.log("Error playing audio: ", error);
        }
    });
}

audioStart.onplaying = () => { isStartPlaying = true; };
audioStart.onended = () => {
    isStartPlaying = false;
    if (jumpQueue) {
        playSound(audioJump);
        jumpQueue = false;
    }
};

function handleJump() {
    if (!gameStarted || gameOver) return;
    bird.velocity = bird.lift; // Apply the final (very weak) lift
    if (isStartPlaying) {
        jumpQueue = true;
    } else {
        playSound(audioJump);
    }
}

// Event Listeners (No changes needed)
document.addEventListener("keydown", function (event) {
    if ((event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !gameOver) {
        if (!gameStarted) startGame(); else handleJump();
    }
    if (event.key.toLowerCase() === "r" && gameOver) resetGame();
});

canvas.addEventListener("touchstart", function (event) {
    event.preventDefault();
    if (!gameOver) {
         if (!gameStarted) startGame(); else handleJump();
    }
}, { passive: false });

// Bird Image (No changes needed)
const birdImage = new Image();
birdImage.src = 'burung.png';
birdImage.onload = () => console.log("Gambar burung dimuat.");
birdImage.onerror = () => console.error("Gagal memuat gambar burung!");

function drawBird() {
    if (birdImage.complete && birdImage.naturalWidth !== 0) {
        ctx.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    } else {
        ctx.fillStyle = "#FFFF00";
        ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }
}

// --- Pipe Drawing Patterns ---
// Restored detailed brick pattern
function drawBrickPattern(x, y, width, height) {
    const brickWidth = dimensions.width * 0.05;
    const brickHeight = dimensions.height * 0.0234;
    const mortar = 1;

    ctx.fillStyle = '#FF6347';
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = mortar;

    let drawMortar = true;

    for (let rowY = y + brickHeight; rowY < y + height; rowY += brickHeight) {
        if (drawMortar) {
            ctx.beginPath(); ctx.moveTo(x, rowY); ctx.lineTo(x + width, rowY); ctx.stroke();
        }
    }
    for (let row = 0; row * brickHeight < height; row++) {
        const startY = y + row * brickHeight;
        const endY = Math.min(startY + brickHeight, y + height);
        const startOffset = (row % 2 === 0) ? 0 : brickWidth / 2;
        for (let colX = x + startOffset; colX < x + width; colX += brickWidth) {
             if (drawMortar && colX > x && colX < x+width) {
                ctx.beginPath(); ctx.moveTo(colX, startY); ctx.lineTo(colX, endY); ctx.stroke();
             }
        }
    }
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
}
// Simplified patterns for others
function drawBambooPattern(x, y, width, height) {
    ctx.fillStyle = '#228B22'; ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#006400'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
}
function drawWoodPattern(x, y, width, height) {
    ctx.fillStyle = '#8B4513'; ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#A0522D'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
}
function drawStonePattern(x, y, width, height) {
    ctx.fillStyle = '#A9A9A9'; ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#696969'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
}
// --- End Pipe Drawing Patterns ---

function getPipeStyle() {
    if (score < 10) return 'brick';
    if (score < 20) return 'bamboo';
    if (score < 30) return 'wood';
    return 'stone';
}

function adjustDifficulty() {
    if (score > 10 && (score - 1) % 10 === 0) {
        pipeSpeed *= DIFFICULTY_INCREASE_FACTOR;
        pipeSpawnInterval = Math.max(MIN_PIPE_SPAWN_INTERVAL, Math.round(pipeSpawnInterval / DIFFICULTY_INCREASE_FACTOR));
        console.log(`Difficulty increased at score ${score}: Speed=${pipeSpeed.toFixed(3)}, Interval=${pipeSpawnInterval}`);
        playSound(audioSuccess);
    }
}

function drawPipes() {
    // Spawn new pipes (MUCH faster first pipe)
    if (frameCount === FIRST_PIPE_SPAWN_FRAME || (frameCount > FIRST_PIPE_SPAWN_FRAME && (frameCount - FIRST_PIPE_SPAWN_FRAME) % pipeSpawnInterval === 0)) {
        const minTopHeight = 50;
        const maxTopHeight = canvas.height - pipeGap - minTopHeight;
        let topPipeHeight = Math.random() * maxTopHeight;
        topPipeHeight = Math.max(minTopHeight, topPipeHeight);

        pipes.push({ x: canvas.width, topHeight: topPipeHeight, scored: false });
    }

    const pipeWidth = dimensions.width * PIPE_WIDTH_RATIO;
    const currentStyle = getPipeStyle();

    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.x -= pipeSpeed;

        const bottomPipeY = pipe.topHeight + pipeGap;
        const bottomPipeHeight = canvas.height - bottomPipeY;

        let drawFunc;
        switch (currentStyle) {
            case 'bamboo': drawFunc = drawBambooPattern; break;
            case 'wood': drawFunc = drawWoodPattern; break;
            case 'stone': drawFunc = drawStonePattern; break;
            default: drawFunc = drawBrickPattern; break;
        }
        drawFunc(pipe.x, 0, pipeWidth, pipe.topHeight);
        drawFunc(pipe.x, bottomPipeY, pipeWidth, bottomPipeHeight);

        // Collision Detection
        if (bird.x < pipe.x + pipeWidth && bird.x + bird.width > pipe.x &&
            (bird.y < pipe.topHeight || bird.y + bird.height > bottomPipeY)) {
            triggerGameOver(); return;
        }
        // Score Increment
        if (!pipe.scored && pipe.x + pipeWidth < bird.x) {
            score++; pipe.scored = true; playSound(audioScore); adjustDifficulty();
        }
        // Remove pipes
        if (pipe.x + pipeWidth < 0) pipes.splice(i, 1);
    }
}

function drawScore() {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${Math.max(24, dimensions.height * 0.05)}px Arial`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)"; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 3;
    ctx.fillText("Skor: " + score, 10, 10);
    ctx.shadowColor = "transparent"; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;
}

function triggerGameOver() {
    if (gameOver) return;
    gameOver = true; playSound(audioGameOver); cancelAnimationFrame(animationId);
    scoreDisplay.textContent = score; gameOverOverlay.style.display = "flex";
}

function update() {
    if (gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Bird Physics
    bird.velocity += bird.gravity; bird.y += bird.velocity;

    // Boundaries
    if (bird.y + bird.height > canvas.height) { bird.y = canvas.height - bird.height; bird.velocity = 0; triggerGameOver(); return; }
    if (bird.y < 0) { bird.y = 0; bird.velocity = 0; }

    // Draw
    drawPipes(); if (gameOver) return;
    drawBird(); drawScore();
    frameCount++;
    animationId = requestAnimationFrame(update);
}

function resetGame() {
    bird.y = dimensions.height / 4; bird.velocity = 0;
    bird.gravity = BASE_GRAVITY; // Reset to final low base gravity
    bird.lift = BASE_LIFT;       // Reset to final low base lift

    pipes = []; score = 0; gameOver = false; gameStarted = false;
    frameCount = 0; // Crucial for first pipe timing on restart
    pipeSpeed = BASE_PIPE_SPEED; pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL;

    isStartPlaying = false; jumpQueue = false;

    gameOverOverlay.style.display = "none"; instructionsOverlay.style.display = "flex";
    cancelAnimationFrame(animationId);
    console.log("Game Reset - Final Adjustments");
}

function startGame() {
    if (gameStarted) return;

    // Ensure correct physics values at start
    bird.gravity = BASE_GRAVITY; bird.lift = BASE_LIFT;
    pipeSpeed = BASE_PIPE_SPEED; pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL;
    frameCount = 0; // Ensure frame count starts at 0

    if (!audioInitialized) { playSound(audioStart); audioInitialized = true; }
    else { playSound(audioStart); }

    gameStarted = true; instructionsOverlay.style.display = "none"; gameOver = false;
    console.log("Game Starting - Final Adjustments");
    update();
}

// Initial Setup and Event Listeners (No major changes needed here)
startButton.addEventListener('click', startGame);
restartButton.addEventListener("click", resetGame);

window.addEventListener('load', () => {
    updateDimensions();
    bird.y = dimensions.height / 4;
});

const resizeObserver = new ResizeObserver(entries => {
     if (entries[0]) {
         console.log("Resize detected, updating dimensions.");
         updateDimensions();
         bird.y = dimensions.height / 4; // Re-center bird
         bird.gravity = BASE_GRAVITY;    // Ensure correct physics
         bird.lift = BASE_LIFT;
         if (!gameStarted && !gameOver) ctx.clearRect(0, 0, canvas.width, canvas.height);
     }
});
resizeObserver.observe(document.body);
window.addEventListener('resize', updateDimensions);

window.addEventListener('keydown', function(e) {
  if(e.code === 'Space' && e.target == document.body) e.preventDefault();
});