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
const PIPE_WIDTH_RATIO = 0.1248; // Wider pipes (120%)
const BASE_GRAVITY = 0.09072; // Extremely low gravity
const BASE_LIFT = -2.1504;  // Extremely weak lift (Reduced 20% AGAIN from -2.688)
const BASE_PIPE_SPEED = 0.5;
const BASE_PIPE_SPAWN_INTERVAL = 450; // Wide horizontal spacing
const FIRST_PIPE_SPAWN_FRAME = 79; // Spawn first pipe MUCH sooner (Reduced 75% AGAIN from 315)
const PIPE_GAP_RATIO = (1 / 3) * 0.75;
const DIFFICULTY_INCREASE_FACTOR = 1.10;
const MIN_PIPE_SPAWN_INTERVAL = 60;

let dimensions = { width: 0, height: 0 };
let pipeGap = 0;

const updateDimensions = () => {
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;

    // Calculate dimensions based on aspect ratio and available space
    if (availableWidth / availableHeight > BASE_ASPECT_RATIO) {
        dimensions.height = Math.min(availableHeight, 640);
        dimensions.width = dimensions.height * BASE_ASPECT_RATIO;
    } else {
        dimensions.width = Math.min(availableWidth, 480);
        dimensions.height = dimensions.width / BASE_ASPECT_RATIO;
    }

    // Ensure dimensions are integers and apply to canvas
    dimensions.width = Math.floor(dimensions.width);
    // *** Adjust height calculation slightly based on game state for positioning ***
    // The body alignment change handles the top positioning, updateDimensions maximizes size within constraints.
    // Let's ensure height doesn't exceed viewport slightly due to borders etc.
    dimensions.height = Math.floor(Math.min(dimensions.height, availableHeight - 10)); // -10 for some buffer room maybe? Or just floor.

    canvas.width = dimensions.width;
    canvas.height = dimensions.height; // Set calculated height

    // Recalculate dynamic sizes
    pipeGap = dimensions.height * PIPE_GAP_RATIO;
    bird.width = dimensions.width * BIRD_WIDTH_RATIO;
    bird.height = dimensions.height * BIRD_HEIGHT_RATIO;

    console.log(`Canvas dimensions set: ${canvas.width}x${canvas.height}`);
};


// Bird object
let bird = {
    x: 50,
    y: 150,
    width: 0,
    height: 0,
    gravity: BASE_GRAVITY, // Use the FINAL adjusted base value
    lift: BASE_LIFT,       // Use the FINAL adjusted base value
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

// Audio Elements (Unchanged)
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
    bird.velocity = bird.lift; // Apply the (FINAL reduced) lift
    if (isStartPlaying) {
        jumpQueue = true;
    } else {
        playSound(audioJump);
    }
}

// Event Listeners (Unchanged)
document.addEventListener("keydown", function (event) {
    if ((event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !gameOver) {
        if (!gameStarted) {
            startGame();
        } else {
            handleJump();
        }
    }
    if (event.key.toLowerCase() === "r" && gameOver) {
        resetGame();
    }
});

canvas.addEventListener("touchstart", function (event) {
    event.preventDefault();
    if (!gameOver) {
         if (!gameStarted) {
            startGame();
         } else {
            handleJump();
         }
    }
}, { passive: false });

// Bird Image (Unchanged)
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
// Restored detailed brick pattern (Unchanged from previous)
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
            ctx.beginPath();
            ctx.moveTo(x, rowY);
            ctx.lineTo(x + width, rowY);
            ctx.stroke();
        }
    }

    for (let row = 0; row * brickHeight < height; row++) {
        const startY = y + row * brickHeight;
        const endY = Math.min(startY + brickHeight, y + height);
        const startOffset = (row % 2 === 0) ? 0 : brickWidth / 2;

        for (let colX = x + startOffset; colX < x + width; colX += brickWidth) {
             if (drawMortar && colX > x && colX < x+width) {
                ctx.beginPath();
                ctx.moveTo(colX, startY);
                ctx.lineTo(colX, endY);
                ctx.stroke();
             }
        }
    }
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
}

// Simplified patterns for others (Unchanged)
function drawBambooPattern(x, y, width, height) { /* ... */ }
function drawWoodPattern(x, y, width, height) { /* ... */ }
function drawStonePattern(x, y, width, height) { /* ... */ }
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
    // Spawn new pipes (with MUCH faster first spawn timing)
    if (frameCount === FIRST_PIPE_SPAWN_FRAME || (frameCount > FIRST_PIPE_SPAWN_FRAME && (frameCount - FIRST_PIPE_SPAWN_FRAME) % pipeSpawnInterval === 0)) {
        const minTopHeight = 50;
        const maxTopHeight = canvas.height - pipeGap - minTopHeight;
        let topPipeHeight = Math.random() * maxTopHeight;
        topPipeHeight = Math.max(minTopHeight, topPipeHeight);

        pipes.push({
            x: canvas.width,
            topHeight: topPipeHeight,
            scored: false
        });
    }

    const pipeWidth = dimensions.width * PIPE_WIDTH_RATIO; // WIDER pipes
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
            case 'brick':
            default: drawFunc = drawBrickPattern; break;
        }

        drawFunc(pipe.x, 0, pipeWidth, pipe.topHeight);
        drawFunc(pipe.x, bottomPipeY, pipeWidth, bottomPipeHeight);

        // Collision Detection (Unchanged)
        if ( /* ... collision logic ... */ ) {
            triggerGameOver();
            return;
        }
        if (
            bird.x < pipe.x + pipeWidth &&
            bird.x + bird.width > pipe.x &&
            (bird.y < pipe.topHeight ||
             bird.y + bird.height > bottomPipeY)
        ) {
            triggerGameOver();
            return; // Exit loop early on collision
        }


        // Score Increment (Unchanged)
        if (!pipe.scored && pipe.x + pipeWidth < bird.x) {
            score++;
            pipe.scored = true;
            playSound(audioScore);
            adjustDifficulty();
        }

        // Remove pipes (Unchanged)
        if (pipe.x + pipeWidth < 0) {
            pipes.splice(i, 1);
        }
    }
}

function drawScore() { // Unchanged
    /* ... drawing score ... */
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${Math.max(24, dimensions.height * 0.05)}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 3;
    ctx.fillText("Skor: " + score, 10, 10);
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
}

function triggerGameOver() { // Unchanged
    /* ... game over logic ... */
    if (gameOver) return;
    gameOver = true;
    playSound(audioGameOver);
    cancelAnimationFrame(animationId);
    scoreDisplay.textContent = score;
    gameOverOverlay.style.display = "flex";
}

function update() {
    if (gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Bird Physics (FINAL gravity)
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // Boundaries (Unchanged)
    if (bird.y + bird.height > canvas.height) {
        bird.y = canvas.height - bird.height;
        bird.velocity = 0;
        triggerGameOver();
        return;
    }
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }

    // Draw
    drawPipes();
    if (gameOver) return;
    drawBird();
    drawScore();

    frameCount++;

    animationId = requestAnimationFrame(update);
}

function resetGame() {
    bird.y = dimensions.height / 4;
    bird.velocity = 0;
    bird.gravity = BASE_GRAVITY; // Reset to FINAL base gravity
    bird.lift = BASE_LIFT;       // Reset to FINAL base lift

    pipes = [];
    score = 0;
    gameOver = false;
    gameStarted = false;
    frameCount = 0; // Reset frame count for first pipe timing
    pipeSpeed = BASE_PIPE_SPEED;
    pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL;

    isStartPlaying = false;
    jumpQueue = false;

    gameOverOverlay.style.display = "none";
    instructionsOverlay.style.display = "flex";

    // *** Restore body alignment for centering overlays ***
    document.body.style.alignItems = 'center';
    // Update dimensions for centered layout *before* showing instructions
    updateDimensions();


    cancelAnimationFrame(animationId);

    console.log("Game Reset with FINAL physics, faster first pipe, centered layout");
}

function startGame() {
    if (gameStarted) return;

    // Ensure correct physics values at start
    bird.gravity = BASE_GRAVITY;
    bird.lift = BASE_LIFT;
    pipeSpeed = BASE_PIPE_SPEED;
    pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL;
    frameCount = 0;


    if (!audioInitialized) {
         playSound(audioStart);
         audioInitialized = true;
    } else {
         playSound(audioStart);
    }

    gameStarted = true;
    instructionsOverlay.style.display = "none";
    gameOver = false;

    // *** Change body alignment to top for game layout ***
    document.body.style.alignItems = 'flex-start';
    // Update dimensions for top-aligned layout *before* starting game loop
    updateDimensions();
    // Reset bird Y position based on potentially new dimensions *after* alignment change
    bird.y = dimensions.height / 4;


    console.log("Game Starting with FINAL physics, faster first pipe, top-aligned layout");
    update();
}

// Initial Setup on Load (Unchanged)
startButton.addEventListener('click', startGame);
restartButton.addEventListener("click", resetGame);

window.addEventListener('load', () => {
    // Initial dimensions calculated with default 'center' alignment
    updateDimensions();
    bird.y = dimensions.height / 4;
});

// Handle resize events
const resizeObserver = new ResizeObserver(entries => {
     if (entries[0]) {
         console.log("Resize detected, updating dimensions for current state.");
         // updateDimensions will now use the current body alignment implicitly
         updateDimensions();
         // Reset bird position based on new dimensions
         // Don't reset gravity/lift here, they are constant BASE values
         bird.y = dimensions.height / 4;

         if (!gameStarted && !gameOver) { // If resized while on instructions
              ctx.clearRect(0, 0, canvas.width, canvas.height);
         }
     }
});

resizeObserver.observe(document.body);
window.addEventListener('resize', () => {
    // Also call updateDimensions on legacy resize event
    console.log("Legacy resize detected, updating dimensions.");
    updateDimensions();
    bird.y = dimensions.height / 4; // Re-center bird Y based on new height
});


// Prevent scrolling with spacebar (Unchanged)
window.addEventListener('keydown', function(e) { /* ... */ });