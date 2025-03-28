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
const BIRD_WIDTH_RATIO = 0.125; // Bird width relative to canvas width
const BIRD_HEIGHT_RATIO = 0.0625; // Bird height relative to canvas height
const PIPE_WIDTH_RATIO = 0.104; // Pipe width relative to canvas width
const BASE_GRAVITY = 0.2;
const BASE_LIFT = -6;
const BASE_PIPE_SPEED = 2;
const BASE_PIPE_SPAWN_INTERVAL = 150; // Frames between pipe spawns
const PIPE_GAP_RATIO = (1 / 3) * 0.75; // Gap is 75% of 1/3rd canvas height
const DIFFICULTY_INCREASE_FACTOR = 1.10; // 10% increase
const MIN_PIPE_SPAWN_INTERVAL = 60; // Minimum frames between spawns

let dimensions = { width: 0, height: 0 };
let pipeGap = 0; // Will be calculated based on dimensions

const updateDimensions = () => {
    // Use innerWidth/innerHeight for available space
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;

    // Calculate max dimensions based on aspect ratio
    if (availableWidth / availableHeight > BASE_ASPECT_RATIO) {
        // Height is the constraint
        dimensions.height = Math.min(availableHeight, 640); // Cap max height
        dimensions.width = dimensions.height * BASE_ASPECT_RATIO;
    } else {
        // Width is the constraint
        dimensions.width = Math.min(availableWidth, 480); // Cap max width
        dimensions.height = dimensions.width / BASE_ASPECT_RATIO;
    }

    // Ensure dimensions are integers for canvas rendering
    dimensions.width = Math.floor(dimensions.width);
    dimensions.height = Math.floor(dimensions.height);

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Recalculate dynamic sizes based on new dimensions
    pipeGap = dimensions.height * PIPE_GAP_RATIO;
    bird.width = dimensions.width * BIRD_WIDTH_RATIO;
    bird.height = dimensions.height * BIRD_HEIGHT_RATIO;
    // Recenter bird vertically if needed (though resetGame handles initial placement)
    // bird.y = dimensions.height / 4;
};


// Bird object
let bird = {
    x: 50,
    y: 150, // Initial Y will be recalculated
    width: 0, // Will be calculated
    height: 0, // Will be calculated
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

// Audio Elements
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
    // No need to check audioInitialized here, browser restrictions apply on first play
    audio.currentTime = 0; // Rewind to start
    audio.play().catch(error => {
        if (!audioInitialized) {
             console.log("Audio interaction needed. Waiting for touch/key.", error.name);
             // Add listeners to play *any* sound on first interaction
             const initAudio = () => {
                 audioInitialized = true;
                 console.log("Audio context resumed by user interaction.");
                 // Try playing the requested sound again
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
    if (!gameStarted || gameOver) return; // Don't jump if game not started or over
    bird.velocity = bird.lift;
    if (isStartPlaying) {
        jumpQueue = true;
    } else {
        playSound(audioJump);
    }
}

// Event Listeners
document.addEventListener("keydown", function (event) {
    // Allow Space or Shift for jump
    if ((event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !gameOver) {
        if (!gameStarted) {
            startGame(); // Start game on first jump if not started
        } else {
            handleJump();
        }
    }
    // Allow 'R' key for restart when game is over
    if (event.key.toLowerCase() === "r" && gameOver) {
        resetGame();
    }
});

canvas.addEventListener("touchstart", function (event) {
    event.preventDefault(); // Prevent default touch behavior like scrolling
    if (!gameOver) {
         if (!gameStarted) {
            startGame(); // Start game on first touch if not started
         } else {
            handleJump();
         }
    }
}, { passive: false });

// Bird Image
const birdImage = new Image();
birdImage.src = 'burung.png';
birdImage.onload = () => console.log("Gambar burung dimuat.");
birdImage.onerror = () => console.error("Gagal memuat gambar burung!");

function drawBird() {
    // Fallback to yellow square if image fails
    if (birdImage.complete && birdImage.naturalWidth !== 0) {
        ctx.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    } else {
        ctx.fillStyle = "#FFFF00"; // Yellow fallback
        ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }
}

// --- Pipe Drawing Patterns (Simplified for brevity, assumed unchanged) ---
function drawBrickPattern(x, y, width, height) {
    // Simplified: Draw red rectangle
    ctx.fillStyle = '#FF6347';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#A52A2A'; // Brown border
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
}
function drawBambooPattern(x, y, width, height) {
    // Simplified: Draw green rectangle
    ctx.fillStyle = '#228B22';
    ctx.fillRect(x, y, width, height);
     ctx.strokeStyle = '#006400'; // Dark green border
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
}
function drawWoodPattern(x, y, width, height) {
    // Simplified: Draw brown rectangle
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x, y, width, height);
     ctx.strokeStyle = '#A0522D'; // Sienna border
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
}
function drawStonePattern(x, y, width, height) {
    // Simplified: Draw gray rectangle
    ctx.fillStyle = '#A9A9A9';
    ctx.fillRect(x, y, width, height);
     ctx.strokeStyle = '#696969'; // Dim gray border
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
}
// --- End Pipe Drawing Patterns ---

function getPipeStyle() {
    // Determine style based on score
    if (score < 10) return 'brick';
    if (score < 20) return 'bamboo';
    if (score < 30) return 'wood';
    return 'stone';
}

function adjustDifficulty() {
    // Increase difficulty by 10% when score crosses a multiple of 10 (11, 21, 31...)
    if (score > 10 && (score - 1) % 10 === 0) {
        pipeSpeed *= DIFFICULTY_INCREASE_FACTOR;
        // Decrease spawn interval, but ensure it doesn't go below minimum
        pipeSpawnInterval = Math.max(MIN_PIPE_SPAWN_INTERVAL, Math.round(pipeSpawnInterval / DIFFICULTY_INCREASE_FACTOR));
        console.log(`Difficulty increased at score ${score}: Speed=${pipeSpeed.toFixed(2)}, Interval=${pipeSpawnInterval}`);
        playSound(audioSuccess);
    }
}

function drawPipes() {
    // Spawn new pipes
    if (frameCount % pipeSpawnInterval === 0) {
        // Ensure top pipe has a minimum height (e.g., 50px) and doesn't go offscreen
        const minTopHeight = 50;
        const maxTopHeight = canvas.height - pipeGap - minTopHeight;
        let topPipeHeight = Math.random() * maxTopHeight;
        topPipeHeight = Math.max(minTopHeight, topPipeHeight); // Ensure min height

        pipes.push({
            x: canvas.width, // Start offscreen right
            topHeight: topPipeHeight, // Height of the top pipe body
            scored: false
        });
    }

    const pipeWidth = dimensions.width * PIPE_WIDTH_RATIO;
    const currentStyle = getPipeStyle();

    // Draw and update existing pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.x -= pipeSpeed; // Move pipe left

        // Calculate bottom pipe position based on top pipe and gap
        const bottomPipeY = pipe.topHeight + pipeGap;
        const bottomPipeHeight = canvas.height - bottomPipeY;

        // Choose drawing pattern based on style
        let drawFunc;
        switch (currentStyle) {
            case 'bamboo': drawFunc = drawBambooPattern; break;
            case 'wood': drawFunc = drawWoodPattern; break;
            case 'stone': drawFunc = drawStonePattern; break;
            case 'brick':
            default: drawFunc = drawBrickPattern; break;
        }

        // Draw top pipe
        drawFunc(pipe.x, 0, pipeWidth, pipe.topHeight);
        // Draw bottom pipe
        drawFunc(pipe.x, bottomPipeY, pipeWidth, bottomPipeHeight);


        // Collision Detection
        if (
            bird.x < pipe.x + pipeWidth &&        // Bird's right edge > pipe's left edge
            bird.x + bird.width > pipe.x &&      // Bird's left edge < pipe's right edge
            (bird.y < pipe.topHeight ||          // Bird's top edge < top pipe's bottom edge
             bird.y + bird.height > bottomPipeY) // Bird's bottom edge > bottom pipe's top edge
        ) {
            triggerGameOver();
            return; // Exit loop early on collision
        }

        // Score Increment
        if (!pipe.scored && pipe.x + pipeWidth < bird.x) {
            score++;
            pipe.scored = true;
            playSound(audioScore);
            adjustDifficulty(); // Check if difficulty needs to increase
        }

        // Remove pipes that are offscreen left
        if (pipe.x + pipeWidth < 0) {
            pipes.splice(i, 1);
        }
    }
}

function drawScore() {
    ctx.fillStyle = "#FFFFFF"; // White text
    ctx.font = `bold ${Math.max(24, dimensions.height * 0.05)}px Arial`; // Scaled font size
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Simple shadow for better visibility
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 3;

    ctx.fillText("Skor: " + score, 10, 10);

    // Reset shadow properties
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
}

function triggerGameOver() {
    if (gameOver) return; // Prevent multiple triggers
    gameOver = true;
    playSound(audioGameOver);
    cancelAnimationFrame(animationId); // Stop the game loop
    scoreDisplay.textContent = score; // Update final score display
    gameOverOverlay.style.display = "flex"; // Show game over screen
}

function update() {
    if (gameOver) return; // Should not run if game is over

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update Bird Physics
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // Check Boundaries
    // Bottom boundary collision
    if (bird.y + bird.height > canvas.height) {
        bird.y = canvas.height - bird.height; // Place bird on floor
        bird.velocity = 0;
        triggerGameOver();
        return; // Stop update on game over
    }
    // Top boundary (prevent flying offscreen)
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0; // Stop upward movement at ceiling
    }

    // Draw Elements
    drawPipes(); // Draw pipes first (background element)
    if (gameOver) return; // Check again if drawPipes triggered game over

    drawBird();
    drawScore();

    frameCount++; // Increment frame counter for pipe spawning

    // Request next frame
    animationId = requestAnimationFrame(update);
}

function resetGame() {
    // Reset bird state
    bird.y = dimensions.height / 4; // Reset position based on current dimensions
    bird.velocity = 0;

    // Reset game state
    pipes = [];
    score = 0;
    gameOver = false;
    gameStarted = false; // Require start again
    frameCount = 0;
    pipeSpeed = BASE_PIPE_SPEED; // Reset speed to base
    pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL; // Reset spawn rate to base

    // Reset audio state flags
    isStartPlaying = false;
    jumpQueue = false;

    // Update UI
    gameOverOverlay.style.display = "none"; // Hide game over screen
    instructionsOverlay.style.display = "flex"; // Show instructions

    // Ensure loop is stopped if reset is called while running (e.g., via 'R' key)
    cancelAnimationFrame(animationId);

    // Optional: Redraw initial state (bird, score 0) if needed before start
    // ctx.clearRect(0, 0, canvas.width, canvas.height);
    // drawBird();
    // drawScore();
    console.log("Game Reset");
}

function startGame() {
    if (gameStarted) return; // Prevent multiple starts

    if (!audioInitialized) {
        // Attempt to play a silent sound or the start sound to unlock audio context
         playSound(audioStart); // Try playing start sound immediately
         audioInitialized = true; // Assume interaction is happening
    } else {
         playSound(audioStart);
    }

    gameStarted = true;
    instructionsOverlay.style.display = "none"; // Hide instructions
    gameOver = false; // Ensure game isn't marked as over

    // Initial draw before loop starts? Might cause a flicker, usually loop handles first frame
    // updateDimensions(); // Ensure dimensions are current
    // bird.y = dimensions.height / 4; // Set initial bird Y based on current dimensions

    console.log("Game Starting");
    update(); // Start the game loop
}

// Initial Setup on Load
startButton.addEventListener('click', startGame);
restartButton.addEventListener("click", resetGame);

// Initial dimension calculation and setup
window.addEventListener('load', () => {
    updateDimensions();
    bird.y = dimensions.height / 4; // Set initial bird Y after first dimension calc
    // Draw initial bird state?
    // ctx.clearRect(0, 0, canvas.width, canvas.height);
    // drawBird();
});

// Handle resize events
const resizeObserver = new ResizeObserver(entries => {
     // We only observe body, so only one entry expected
     if (entries[0]) {
         // Avoid resizing if game is running to prevent jarring changes? Or allow it?
         // Let's allow it, updateDimensions handles recalculations.
         console.log("Resize detected, updating dimensions.");
         updateDimensions();
         // If game is not running, redraw initial state elements
         if (!gameStarted && !gameOver) {
              bird.y = dimensions.height / 4; // Re-center bird
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // drawBird(); // Maybe draw bird in starting position
         } else if (gameOver) {
             // Adjust overlay maybe? CSS handles it mostly.
         }
     }
});

// Observe the body or a container element for size changes
resizeObserver.observe(document.body);

// Fallback for older browsers or different resize scenarios
window.addEventListener('resize', updateDimensions);

// Prevent scrolling with spacebar
window.addEventListener('keydown', function(e) {
  if(e.code === 'Space' && e.target == document.body) {
    e.preventDefault();
  }
});