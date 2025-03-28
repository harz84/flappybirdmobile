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
const BASE_LIFT = -2.1504;  // Final adjusted weak lift
const BASE_PIPE_SPEED = 0.5;
const BASE_PIPE_SPAWN_INTERVAL = 450;
const FIRST_PIPE_SPAWN_FRAME = 79; // VERY fast first pipe spawn
const PIPE_GAP_RATIO = (1 / 3) * 0.75;
const DIFFICULTY_INCREASE_FACTOR = 1.10;
const MIN_PIPE_SPAWN_INTERVAL = 60;

let dimensions = { width: 0, height: 0 };
let pipeGap = 0;

const updateDimensions = () => {
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;

    // Calculate target dimensions based on aspect ratio, fitting within available space
    // Prioritize fitting height first, then adjust width if needed
    let targetHeight = availableHeight;
    let targetWidth = targetHeight * BASE_ASPECT_RATIO;

    // If calculated width is too wide for the screen, constrain by width and recalculate height
    if (targetWidth > availableWidth) {
        targetWidth = availableWidth;
        targetHeight = targetWidth / BASE_ASPECT_RATIO;
    }

    // Apply calculated dimensions, ensuring they fit within the viewport
    dimensions.width = Math.floor(Math.min(targetWidth, availableWidth));
    dimensions.height = Math.floor(Math.min(targetHeight, availableHeight));

    // Update canvas element size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Style canvas to ensure it's centered (although body flexbox should handle this)
    // canvas.style.marginTop = `${(availableHeight - dimensions.height) / 2}px`; // Optional: fine-tune centering if flexbox isn't perfect

    // Recalculate dynamic sizes based on actual canvas dimensions
    pipeGap = dimensions.height * PIPE_GAP_RATIO;
    bird.width = dimensions.width * BIRD_WIDTH_RATIO;
    bird.height = dimensions.height * BIRD_HEIGHT_RATIO;

    console.log(`Canvas Dimensions Updated: ${dimensions.width}x${dimensions.height}`); // Debugging
};


// Bird object
let bird = {
    x: 50,
    y: 150,
    width: 0,
    height: 0,
    gravity: BASE_GRAVITY,
    lift: BASE_LIFT,
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

// Audio Elements (No changes)
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
             console.log("Audio interaction needed.", error.name);
             const initAudio = () => {
                 audioInitialized = true;
                 console.log("Audio context resumed.");
                 audio.play().catch(err => console.log("Retry failed: ", err));
                 document.removeEventListener('keydown', initAudio);
                 canvas.removeEventListener('touchstart', initAudio);
             };
             document.addEventListener('keydown', initAudio, { once: true });
             canvas.addEventListener('touchstart', initAudio, { once: true });
        } else {
             console.log("Audio play error: ", error);
        }
    });
}

audioStart.onplaying = () => { isStartPlaying = true; };
audioStart.onended = () => {
    isStartPlaying = false;
    if (jumpQueue) { playSound(audioJump); jumpQueue = false; }
};

function handleJump() {
    if (!gameStarted || gameOver) return;
    bird.velocity = bird.lift;
    if (isStartPlaying) { jumpQueue = true; } else { playSound(audioJump); }
}

// Event Listeners (No changes)
document.addEventListener("keydown", function (event) {
    if ((event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !gameOver) {
        if (!gameStarted) startGame(); else handleJump();
    }
    if (event.key.toLowerCase() === "r" && gameOver) resetGame();
});
canvas.addEventListener("touchstart", function (event) {
    event.preventDefault();
    if (!gameOver) { if (!gameStarted) startGame(); else handleJump(); }
}, { passive: false });

// Bird Image (No changes)
const birdImage = new Image();
birdImage.src = 'burung.png';
birdImage.onload = () => console.log("Bird image loaded.");
birdImage.onerror = () => console.error("Failed to load bird image!");

function drawBird() {
    if (birdImage.complete && birdImage.naturalWidth !== 0) {
        ctx.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    } else {
        ctx.fillStyle = "#FFFF00"; ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }
}

// --- Pipe Drawing Patterns --- (Brick pattern restored, others simplified)
function drawBrickPattern(x, y, width, height) {
    const brickWidth = dimensions.width * 0.05; const brickHeight = dimensions.height * 0.0234; const mortar = 1;
    ctx.fillStyle = '#FF6347'; ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#A0522D'; ctx.lineWidth = mortar; let drawMortar = true;
    for (let rowY = y + brickHeight; rowY < y + height; rowY += brickHeight) { if (drawMortar) { ctx.beginPath(); ctx.moveTo(x, rowY); ctx.lineTo(x + width, rowY); ctx.stroke(); } }
    for (let row = 0; row * brickHeight < height; row++) {
        const startY = y + row * brickHeight; const endY = Math.min(startY + brickHeight, y + height);
        const startOffset = (row % 2 === 0) ? 0 : brickWidth / 2;
        for (let colX = x + startOffset; colX < x + width; colX += brickWidth) { if (drawMortar && colX > x && colX < x + width) { ctx.beginPath(); ctx.moveTo(colX, startY); ctx.lineTo(colX, endY); ctx.stroke(); } }
    }
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);
}
function drawBambooPattern(x,y,w,h){ctx.fillStyle='#228B22';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#006400';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
function drawWoodPattern(x,y,w,h){ctx.fillStyle='#8B4513';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#A0522D';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
function drawStonePattern(x,y,w,h){ctx.fillStyle='#A9A9A9';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#696969';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
// --- End Pipe Drawing Patterns ---

function getPipeStyle() {
    if (score < 10) return 'brick'; if (score < 20) return 'bamboo';
    if (score < 30) return 'wood'; return 'stone';
}

function adjustDifficulty() {
    if (score > 10 && (score - 1) % 10 === 0) {
        pipeSpeed *= DIFFICULTY_INCREASE_FACTOR;
        pipeSpawnInterval = Math.max(MIN_PIPE_SPAWN_INTERVAL, Math.round(pipeSpawnInterval / DIFFICULTY_INCREASE_FACTOR));
        console.log(`Difficulty+ S:${score} Spd:${pipeSpeed.toFixed(3)} Int:${pipeSpawnInterval}`);
        playSound(audioSuccess);
    }
}

function drawPipes() {
    // Spawn logic (very fast first pipe)
    if (frameCount === FIRST_PIPE_SPAWN_FRAME || (frameCount > FIRST_PIPE_SPAWN_FRAME && (frameCount - FIRST_PIPE_SPAWN_FRAME) % pipeSpawnInterval === 0)) {
        const minTopH = 50; const maxTopH = canvas.height - pipeGap - minTopH;
        let topH = Math.max(minTopH, Math.random() * maxTopH);
        pipes.push({ x: canvas.width, topHeight: topH, scored: false });
    }

    const pipeW = dimensions.width * PIPE_WIDTH_RATIO; const style = getPipeStyle();

    for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i]; p.x -= pipeSpeed;
        const botY = p.topHeight + pipeGap; const botH = canvas.height - botY;
        let drawFunc;
        switch (style) {
            case 'bamboo': drawFunc = drawBambooPattern; break; case 'wood': drawFunc = drawWoodPattern; break;
            case 'stone': drawFunc = drawStonePattern; break; default: drawFunc = drawBrickPattern; break;
        }
        drawFunc(p.x, 0, pipeW, p.topHeight); drawFunc(p.x, botY, pipeW, botH);

        if (bird.x < p.x + pipeW && bird.x + bird.width > p.x && (bird.y < p.topHeight || bird.y + bird.height > botY)) { triggerGameOver(); return; }
        if (!p.scored && p.x + pipeW < bird.x) { score++; p.scored = true; playSound(audioScore); adjustDifficulty(); }
        if (p.x + pipeW < 0) pipes.splice(i, 1);
    }
}

function drawScore() {
    ctx.fillStyle="#FFF"; ctx.font=`bold ${Math.max(24,dimensions.height*0.05)}px Arial`; ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.shadowColor="rgba(0,0,0,0.5)"; ctx.shadowOffsetX=2; ctx.shadowOffsetY=2; ctx.shadowBlur=3;
    ctx.fillText("Skor: "+score, 10, 10);
    ctx.shadowColor="transparent"; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; ctx.shadowBlur=0;
}

function triggerGameOver() {
    if (gameOver) return; gameOver = true; playSound(audioGameOver); cancelAnimationFrame(animationId);
    scoreDisplay.textContent = score; gameOverOverlay.style.display = "flex";
}

function update() {
    if (gameOver) return; ctx.clearRect(0, 0, canvas.width, canvas.height);
    bird.velocity += bird.gravity; bird.y += bird.velocity;
    if (bird.y + bird.height > canvas.height) { bird.y = canvas.height - bird.height; bird.velocity = 0; triggerGameOver(); return; }
    if (bird.y < 0) { bird.y = 0; bird.velocity = 0; }
    drawPipes(); if (gameOver) return;
    drawBird(); drawScore(); frameCount++;
    animationId = requestAnimationFrame(update);
}

function resetGame() {
    // Hide canvas, show instructions
    canvas.style.display = 'none'; // Hide canvas when resetting
    instructionsOverlay.style.display = 'flex'; // Ensure instructions are shown
    gameOverOverlay.style.display = 'none'; // Hide game over

    // Reset game state
    bird.y = dimensions.height / 4; bird.velocity = 0;
    bird.gravity = BASE_GRAVITY; bird.lift = BASE_LIFT;
    pipes = []; score = 0; gameOver = false; gameStarted = false; frameCount = 0;
    pipeSpeed = BASE_PIPE_SPEED; pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL;
    isStartPlaying = false; jumpQueue = false;

    cancelAnimationFrame(animationId);
    console.log("Game Reset - Canvas hidden");
}

function startGame() {
    if (gameStarted) return;

    // Update dimensions one last time before starting maybe? Or assume load/resize handled it.
    // updateDimensions(); // Optional, might cause flicker if called unnecessarily

    // Show canvas, hide instructions
    instructionsOverlay.style.display = 'none'; // Hide instructions
    canvas.style.display = 'block'; // Show canvas *** HERE ***

    // Reset physics and frame count for a clean start
    bird.gravity = BASE_GRAVITY; bird.lift = BASE_LIFT;
    pipeSpeed = BASE_PIPE_SPEED; pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL;
    frameCount = 0; // Ensure frame count is 0 for first pipe timing
    bird.y = dimensions.height / 4; // Ensure bird starts at correct position
    bird.velocity = 0;


    // Audio
    if (!audioInitialized) { playSound(audioStart); audioInitialized = true; }
    else { playSound(audioStart); }

    // Start game state
    gameStarted = true;
    gameOver = false;

    console.log("Game Starting - Canvas shown");
    update(); // Start the main game loop
}

// Initial Setup & Event Listeners
startButton.addEventListener('click', startGame);
restartButton.addEventListener("click", resetGame);

// Initial dimension calculation on load
window.addEventListener('load', () => {
    console.log("Window loaded, setting initial dimensions.");
    updateDimensions();
    // Don't set bird.y here, resetGame/startGame handle initial position before drawing starts
    // Make sure instructions are visible and canvas hidden initially (CSS handles this now)
    instructionsOverlay.style.display = 'flex';
    canvas.style.display = 'none';
});

// Resize handling
const resizeObserver = new ResizeObserver(entries => {
     if (entries[0]) {
         console.log("Resize detected, updating dimensions.");
         updateDimensions(); // Update dimensions based on new size
         // If game hasn't started or is over, reset bird position based on new size
         if (!gameStarted || gameOver) {
             bird.y = dimensions.height / 4;
         }
         // If game *is* running, the bird continues from its current position,
         // but new pipes/boundaries will use the updated dimensions.
         // Optional: redraw canvas if needed when not actively playing
         if (!gameStarted && !gameOver) {
             // Instructions are showing, no need to redraw canvas
         } else if (gameOver) {
             // Game over screen is showing, maybe redraw final bird/pipe state?
             // Or just let the overlay handle it.
         }
     }
});
resizeObserver.observe(document.body); // Observe body size changes
window.addEventListener('resize', updateDimensions); // Fallback listener

// Spacebar scroll prevention
window.addEventListener('keydown', function(e) { if(e.code === 'Space' && e.target == document.body) e.preventDefault(); });