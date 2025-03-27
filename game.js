const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const restartButton = document.getElementById("restartButton");
const scoreDisplay = document.getElementById("finalScore");
const gameOverTextElement = document.getElementById("gameOverText");

const instructionsOverlay = document.getElementById("instructions");
const startButton = document.getElementById("startButton");

// Tambahkan event listener untuk tombol Mulai Main
startButton.addEventListener('click', startGame);

// Tambahkan event listener untuk tombol Restart
restartButton.addEventListener('click', resetGame);

let dimensions = { width: 0, height: 0 };
const updateDimensions = () => {
    const maxWidth = Math.min(window.innerWidth, 480);
    const maxHeight = Math.min(window.innerHeight, 640);
    const aspectRatio = 480 / 640;

    if (maxWidth / maxHeight > aspectRatio) {
        dimensions.height = maxHeight;
        dimensions.width = maxHeight * aspectRatio;
    } else {
        dimensions.width = maxWidth;
        dimensions.height = maxWidth / aspectRatio;
    }

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
};

updateDimensions();
window.addEventListener('resize', updateDimensions);

let bird = {
    x: 50,
    y: canvas.height / 4,
    width: dimensions.width * 0.125,
    height: dimensions.height * 0.0625,
    gravity: 0.1,
    lift: -4.5 * 0.7, // Dikurangi menjadi 70% dari nilai asli
    velocity: 0
};

let pipes = [];
let frameCount = 0;
let score = 0;
let gameOver = false;
let audioInitialized = false;
let gameStarted = false;
let pipeSpeed = 0.75;
let pipeSpawnInterval = 150 * 2.5; // Ditambah menjadi 2,5 kali dari nilai asli
let pipeGap = dimensions.height / 3;
let initialPipeSpawnInterval = pipeSpawnInterval;
let initialPipeGap = pipeGap;
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
    if (!audioInitialized) {
        audioInitialized = true;
        console.log("Audio initialized by user interaction");
    }
    audio.play().catch(error => {
        console.log("Error playing audio: ", error);
        document.addEventListener('keydown', () => {
            audio.play().catch(err => console.log("Retry audio play failed: ", err));
        }, { once: true });
        document.addEventListener('touchstart', () => {
            audio.play().catch(err => console.log("Retry audio play failed: ", err));
        }, { once: true });
    });
}

audioStart.onended = () => {
    isStartPlaying = false;
    if (jumpQueue) {
        playSound(audioJump);
        jumpQueue = false;
    }
};

function handleJump() {
    if (!gameStarted) return;
    bird.velocity = bird.lift;
    if (isStartPlaying) {
        jumpQueue = true;
    } else {
        playSound(audioJump);
    }
}

document.addEventListener("keydown", function (event) {
    if ((event.key === " " || event.shiftKey) && !gameOver) {
        handleJump();
        if (!audioInitialized) {
            playSound(audioStart);
        }
    }
    if (event.key.toLowerCase() === "r" && gameOver) {
        resetGame();
    }
});

canvas.addEventListener("touchstart", function (event) {
    event.preventDefault();
    if (!gameOver) {
        handleJump();
        if (!audioInitialized) {
            playSound(audioStart);
        }
    }
}, { passive: false });

const birdImage = new Image();
birdImage.src = 'burung.png';

function drawBird() {
    if (birdImage.complete && birdImage.naturalWidth !== 0) {
        ctx.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    } else {
        console.log("Gambar burung belum dimuat atau rusak!");
        ctx.fillStyle = "#FFFF00";
        ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }
}

function drawBrickPattern(x, y, width, height) {
    const brickWidth = dimensions.width * 0.05;
    const brickHeight = dimensions.height * 0.0234;
    const brickColor = ctx.createLinearGradient(x, y, x + width, y);
    brickColor.addColorStop(0, '#FF6347');
    brickColor.addColorStop(1, '#FA8072');
    ctx.fillStyle = brickColor;
    for (let row = 0; row < Math.ceil(height / brickHeight); row++) {
        for (let col = 0; col < Math.ceil(width / brickWidth); col++) {
            const brickX = x + col * brickWidth + (row % 2 === 0 ? 0 : brickWidth / 2);
            const brickY = y + row * brickHeight;
            ctx.fillRect(brickX, brickY, brickWidth - 2, brickHeight - 2);
            ctx.strokeStyle = '#808080';
            ctx.lineWidth = 2;
            ctx.strokeRect(brickX, brickY, brickWidth - 2, brickHeight - 2);
        }
    }
}

function drawBambooPattern(x, y, width, height) {
    const bambooColor = ctx.createLinearGradient(x, y, x + width, y);
    bambooColor.addColorStop(0, '#228B22');
    bambooColor.addColorStop(1, '#2E8B57');
    ctx.fillStyle = bambooColor;
    ctx.fillRect(x, y, width, height);
    const segmentHeight = dimensions.height * 0.156;
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    for (let i = 0; i < Math.ceil(height / segmentHeight); i++) {
        const segmentY = y + i * segmentHeight;
        if (segmentY < y + height) {
            ctx.beginPath();
            ctx.moveTo(x, segmentY);
            ctx.lineTo(x + width, segmentY);
            ctx.stroke();
            const side = i % 2 === 0 ? 'left' : 'right';
            const stemX = side === 'left' ? x : x + width;
            const stemEndX = side === 'left' ? x - 20 : x + width + 20;
            const stemY = segmentY + 10;
            ctx.beginPath();
            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 1;
            ctx.moveTo(stemX, stemY);
            ctx.lineTo(stemEndX, stemY - 10);
            ctx.stroke();
            ctx.fillStyle = '#32CD32';
            ctx.beginPath();
            ctx.ellipse(stemEndX, stemY - 10, 8, 3, side === 'left' ? Math.PI / 4 : -Math.PI / 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawWoodPattern(x, y, width, height) {
    const woodColor = ctx.createLinearGradient(x, y, x + width, y);
    woodColor.addColorStop(0, '#8B4513');
    woodColor.addColorStop(1, '#D2B48C');
    ctx.fillStyle = woodColor;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 1;
    for (let i = 0; i < height; i += 10) {
        ctx.beginPath();
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + width, y + i);
        ctx.stroke();
    }
    for (let i = 0; i < width; i += 15) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i, y + height);
        ctx.stroke();
    }
}

function drawStonePattern(x, y, width, height) {
    const stoneColors = ['#D2B48C', '#F5F5DC', '#A9A9A9'];
    ctx.fillStyle = stoneColors[Math.floor(Math.random() * stoneColors.length)];
    ctx.fillRect(x, y, width, height);
    const stoneCount = 10;
    for (let i = 0; i < stoneCount; i++) {
        const stoneX = x + Math.random() * width;
        const stoneY = y + Math.random() * height;
        const stoneWidth = 20 + Math.random() * 30;
        const stoneHeight = 15 + Math.random() * 20;
        ctx.fillStyle = stoneColors[Math.floor(Math.random() * stoneColors.length)];
        ctx.beginPath();
        ctx.ellipse(stoneX, stoneY, stoneWidth / 2, stoneHeight / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#696969';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function getPipeColors() {
    if (score < 10) {
        return { body: ['#FF6347', '#FA8072'], edge: ['#FF6347', '#FA8072'], pattern: 'brick' };
    } else if (score < 20) {
        return { body: ['#228B22', '#2E8B57'], edge: ['#228B22', '#2E8B57'], pattern: 'bamboo' };
    } else if (score < 30) {
        return { body: ['#8B4513', '#D2B48C'], edge: ['#8B4513', '#D2B48C'], pattern: 'wood' };
    } else {
        return { body: ['#D2B48C', '#F5F5DC'], edge: ['#A9A9A9', '#696969'], pattern: 'stone' };
    }
}

function adjustDifficulty() {
    if (score === 5) {
        pipeSpeed = 1.5 * 1.15;
        pipeSpawnInterval = Math.round(initialPipeSpawnInterval * 0.85);
        pipeGap = Math.round(initialPipeGap * 0.85);
        playSound(audioSuccess);
    } else if (score === 10) {
        pipeSpeed = 1.5 * 1.15 * 1.15;
        pipeSpawnInterval = Math.round(initialPipeSpawnInterval * 0.85 * 0.85);
        pipeGap = Math.round(initialPipeGap * 0.85 * 0.85);
        playSound(audioSuccess);
    } else if (score === 15) {
        pipeSpeed = 1.5 * 1.15 * 1.15 * 1.15;
        pipeSpawnInterval = Math.round(initialPipeSpawnInterval * 0.85 * 0.85 * 0.85);
        pipeGap = Math.round(initialPipeGap * 0.85 * 0.85 * 0.85);
        playSound(audioSuccess);
    }
}

function drawPipes() {
    if (frameCount % pipeSpawnInterval === 0) {
        let pipeHeight = Math.floor(Math.random() * (canvas.height - pipeGap)) + 50;
        pipes.push({
            x: canvas.width,
            top: pipeHeight,
            bottom: canvas.height - pipeHeight - pipeGap,
            scored: false
        });
    }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= pipeSpeed;
        const colors = getPipeColors();
        const pipeWidth = dimensions.width * 0.104;
        if (colors.pattern === 'brick') {
            drawBrickPattern(pipes[i].x, 0, pipeWidth, pipes[i].top - 15);
            drawBrickPattern(pipes[i].x, pipes[i].top - 15, pipeWidth, 15);
        } else if (colors.pattern === 'bamboo') {
            drawBambooPattern(pipes[i].x, 0, pipeWidth, pipes[i].top - 15);
            drawBambooPattern(pipes[i].x, pipes[i].top - 15, pipeWidth, 15);
        } else if (colors.pattern === 'wood') {
            drawWoodPattern(pipes[i].x, 0, pipeWidth, pipes[i].top - 15);
            drawWoodPattern(pipes[i].x, pipes[i].top - 15, pipeWidth, 15);
        } else if (colors.pattern === 'stone') {
            drawStonePattern(pipes[i].x, 0, pipeWidth, pipes[i].top - 15);
            drawStonePattern(pipes[i].x, pipes[i].top - 15, pipeWidth, 15);
        } else {
            let gradientTopBody = ctx.createLinearGradient(pipes[i].x, 0, pipes[i].x + pipeWidth, 0);
            gradientTopBody.addColorStop(0, colors.body[0]);
            gradientTopBody.addColorStop(0.5, colors.body[1]);
            gradientTopBody.addColorStop(1, colors.body[0]);
            ctx.fillStyle = gradientTopBody;
            ctx.fillRect(pipes[i].x, 0, pipeWidth, pipes[i].top - 15);
            let gradientTopEnd = ctx.createLinearGradient(pipes[i].x, pipes[i].top - 15, pipes[i].x + pipeWidth, pipes[i].top - 15);
            gradientTopEnd.addColorStop(0, colors.edge[0]);
            gradientTopEnd.addColorStop(0.5, colors.edge[1]);
            gradientTopEnd.addColorStop(1, colors.edge[0]);
            ctx.fillStyle = gradientTopEnd;
            ctx.fillRect(pipes[i].x, pipes[i].top - 15, pipeWidth, 15);
        }
        if (colors.pattern === 'brick') {
            drawBrickPattern(pipes[i].x, canvas.height - pipes[i].bottom + 15, pipeWidth, pipes[i].bottom - 15);
            drawBrickPattern(pipes[i].x, canvas.height - pipes[i].bottom, pipeWidth, 15);
        } else if (colors.pattern === 'bamboo') {
            drawBambooPattern(pipes[i].x, canvas.height - pipes[i].bottom + 15, pipeWidth, pipes[i].bottom - 15);
            drawBambooPattern(pipes[i].x, canvas.height - pipes[i].bottom, pipeWidth, 15);
        } else if (colors.pattern === 'wood') {
            drawWoodPattern(pipes[i].x, canvas.height - pipes[i].bottom + 15, pipeWidth, pipes[i].bottom - 15);
            drawWoodPattern(pipes[i].x, canvas.height - pipes[i].bottom, pipeWidth, 15);
        } else if (colors.pattern === 'stone') {
            drawStonePattern(pipes[i].x, canvas.height - pipes[i].bottom + 15, pipeWidth, pipes[i].bottom - 15);
            drawStonePattern(pipes[i].x, canvas.height - pipes[i].bottom, pipeWidth, 15);
        } else {
            let gradientBottomBody = ctx.createLinearGradient(pipes[i].x, canvas.height, pipes[i].x + pipeWidth, canvas.height);
            gradientBottomBody.addColorStop(0, colors.body[0]);
            gradientBottomBody.addColorStop(0.5, colors.body[1]);
            gradientBottomBody.addColorStop(1, colors.body[0]);
            ctx.fillStyle = gradientBottomBody;
            ctx.fillRect(pipes[i].x, canvas.height - pipes[i].bottom + 15, pipeWidth, pipes[i].bottom - 15);
            let gradientBottomEnd = ctx.createLinearGradient(pipes[i].x, canvas.height - pipes[i].bottom, pipes[i].x + pipeWidth, canvas.height - pipes[i].bottom);
            gradientBottomEnd.addColorStop(0, colors.edge[0]);
            gradientBottomEnd.addColorStop(0.5, colors.edge[1]);
            gradientBottomEnd.addColorStop(1, colors.edge[0]);
            ctx.fillStyle = gradientBottomEnd;
            ctx.fillRect(pipes[i].x, canvas.height - pipes[i].bottom, pipeWidth, 15);
        }
        if (
            bird.x + bird.width > pipes[i].x &&
            bird.x < pipes[i].x + pipeWidth &&
            (
                (bird.y + bird.height > pipes[i].top && bird.y < pipes[i].top) ||
                (bird.y < canvas.height - pipes[i].bottom && bird.y + bird.height > canvas.height - pipes[i].bottom)
            )
        ) {
            gameOver = true;
            playSound(audioGameOver);
            gameOverOverlay.style.display = "flex";
            scoreDisplay.textContent = score;
            cancelAnimationFrame(animationId);
        }
        if (pipes[i].x + pipeWidth < bird.x && !pipes[i].scored) {
            score++;
            pipes[i].scored = true;
            playSound(audioScore);
            adjustDifficulty();
        }
        if (pipes[i].x < -pipeWidth) {
            pipes.splice(i, 1);
        }
    }
}

function drawScore() {
    ctx.fillStyle = "#000000";
    ctx.font = "bold 30px Arial";
    ctx.shadowColor = "white";
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 5;
    ctx.fillText("Skor: " + score, 30, 50);
    ctx.shadowBlur = 0;
}

let animationId;
function update() {
    if (gameOver) {
        return;
    }
    if (!gameStarted) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    if (bird.y + bird.height > canvas.height) {
        bird.y = canvas.height - bird.height;
        bird.velocity = 0;
        gameOver = true;
        playSound(audioGameOver);
        gameOverOverlay.style.display = "flex";
        scoreDisplay.textContent = score;
        cancelAnimationFrame(animationId);
    }
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }
    drawBird();
    drawPipes();
    drawScore();
    frameCount++;
    animationId = requestAnimationFrame(update);
}

function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        instructionsOverlay.style.display = "none";
        update();
    }
}

function resetGame() {
    bird.y = canvas.height / 4;
    bird.velocity = 0;
    pipes = [];
    score = 0;
    gameOver = false;
    isStartPlaying = true;
    jumpQueue = false;
    pipeSpeed = 0.75;
    pipeSpawnInterval = initialPipeSpawnInterval;
    pipeGap = initialPipeGap;
    gameOverOverlay.style.display = "none";
    frameCount = 0;
    gameStarted = false;
    instructionsOverlay.style.display = "flex";
}