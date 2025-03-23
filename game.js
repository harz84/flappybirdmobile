--- START OF FILE game.js ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Variabel Permainan ---
let bird = {
    x: 50,
    y: 150,
    width: 50, // Sedikit dikurangi agar lebih ringan
    height: 35, // Sedikit dikurangi agar lebih ringan
    gravity: 0.3,
    lift: -6,
    velocity: 0
};

let pipes = [];
let frameCount = 0;
let score = 0;
let gameOver = false;
let audioInitialized = false;

// --- Variabel untuk Kesulitan ---
let pipeSpeed = 1.5;
let pipeSpawnInterval = 150;
let pipeGap = 200;

// --- Audio effects ---
const audioStart = new Audio('start.wav');
const audioJump = new Audio('jump.wav');
const audioScore = new Audio('score.wav');
const audioGameOver = new Audio('gameover.wav');
const audioSuccess = new Audio('success.mp3');

// Pramuat audio
[audioStart, audioJump, audioScore, audioGameOver, audioSuccess].forEach(audio => {
    audio.preload = 'auto';
    audio.load();
});

// --- Variabel kontrol audio dan antrian lompat ---
let isStartPlaying = false;
let jumpQueue = false;

// --- Fungsi untuk memainkan suara dengan penanganan error ---
function playSound(audio) {
    if (!audioInitialized) {
        audioInitialized = true;
        console.log("Audio initialized by user interaction");
    }
    audio.play().catch(error => {
        console.log("Error playing audio: ", error);
        // Alternatif penanganan error audio (opsional):
        // document.addEventListener('keydown', () => {
        //     audio.play().catch(err => console.log("Retry audio play failed: ", err));
        // }, { once: true });
    });
}

// --- Event listener untuk mendeteksi akhir suara start ---
audioStart.onended = () => {
    isStartPlaying = false;
    if (jumpQueue) {
        playSound(audioJump);
        jumpQueue = false;
    }
};

// --- Fungsi untuk menangani lompatan ---
function handleJump() {
    bird.velocity = bird.lift;
    if (isStartPlaying) {
        jumpQueue = true;
    } else {
        playSound(audioJump);
    }
}

// --- Kontrol input (Keyboard dan Touch) ---
function handleInput() {
    function jumpInput() {
        if (!gameOver) {
            handleJump();
            if (!audioInitialized) {
                playSound(audioStart);
            }
        }
    }

    document.addEventListener("keydown", function(event) {
        if ((event.key === " " || event.shiftKey)) { // Spasi atau Shift untuk lompat
            jumpInput();
        }
        if (event.key.toLowerCase() === "r" && gameOver) {
            resetGame();
        }
    });

    canvas.addEventListener("touchstart", function(event) {
        event.preventDefault(); // Mencegah scroll/zoom
        jumpInput();
    }, { passive: false });
}
handleInput(); // Inisialisasi input handling

// --- Muat gambar burung ---
const birdImage = new Image();
birdImage.src = 'burung.png';

// Fungsi untuk menggambar burung (dari gambar atau placeholder)
function drawBird() {
    if (birdImage.complete && birdImage.naturalWidth !== 0) {
        ctx.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    } else {
        console.log("Gambar burung belum dimuat atau rusak!");
        ctx.fillStyle = "#FFFF00"; // Placeholder kuning
        ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    }
}

// --- Fungsi-fungsi pola pipa (Disederhanakan untuk performa) ---
// Fungsi pola bata (Disederhanakan)
function drawBrickPattern(x, y, width, height) {
    ctx.fillStyle = '#FA8072'; // Salmon sebagai warna bata sederhana
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#FF6347'; // Tomato untuk garis tepi
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
}

// Fungsi pola bambu (Disederhanakan)
function drawBambooPattern(x, y, width, height) {
    ctx.fillStyle = '#2E8B57'; // SeaGreen sebagai warna bambu sederhana
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#228B22'; // ForestGreen untuk ruas
    ctx.lineWidth = 5;
    for (let i = 0; i < height; i += 50) { // Ruas bambu lebih jarang
        ctx.beginPath();
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + width, y + i);
        ctx.stroke();
    }
}

// Fungsi pola kayu (Disederhanakan)
function drawWoodPattern(x, y, width, height) {
    ctx.fillStyle = '#D2B48C'; // Tan sebagai warna kayu sederhana
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#8B4513'; // SaddleBrown untuk serat
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 10) { // Serat kayu vertikal saja, lebih jarang
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i, y + height);
        ctx.stroke();
    }
}

// Fungsi pola batu (Disederhanakan)
function drawStonePattern(x, y, width, height) {
    ctx.fillStyle = '#A9A9A9'; // DarkGray sebagai warna batu sederhana
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#696969'; // DimGray untuk tepi batu
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 3, height / 3, 0, 0, 2 * Math.PI); // Satu batu besar di tengah
    ctx.stroke();
}


// Fungsi untuk menentukan warna dan pola pipa (Sama seperti sebelumnya)
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

// Fungsi untuk menyesuaikan kesulitan (Sama seperti sebelumnya)
function adjustDifficulty() {
    if (score === 10) {
        pipeSpeed = 1.5 * 1.15;
        pipeSpawnInterval = Math.round(150 * 0.85);
        pipeGap = Math.round(200 * 0.85);
        playSound(audioSuccess);
    } else if (score === 20) {
        pipeSpeed = 1.5 * 1.15 * 1.15;
        pipeSpawnInterval = Math.round(150 * 0.85 * 0.85);
        pipeGap = Math.round(200 * 0.85 * 0.85);
        playSound(audioSuccess);
    } else if (score === 30) {
        pipeSpeed = 1.5 * 1.15 * 1.15 * 1.15;
        pipeSpawnInterval = Math.round(150 * 0.85 * 0.85 * 0.85);
        pipeGap = Math.round(200 * 0.85 * 0.85 * 0.85);
        playSound(audioSuccess);
    }
}

// Fungsi untuk membuat dan menggambar pipa (Pola Pipa Disederhanakan)
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

        // Fungsi untuk menggambar pipa dengan pola yang disederhanakan
        function drawSimplifiedPipe(x, topHeight, bottomHeight, pattern) {
            const pipeWidth = 50; // Lebar pipa tetap

            // Pipa Atas
            ctx.fillStyle = colors.body[0]; // Warna badan utama
            ctx.fillRect(x, 0, pipeWidth, topHeight - 15); // Badan pipa atas dikurangi tepinya
            ctx.fillStyle = colors.edge[0]; // Warna tepi
            ctx.fillRect(x, topHeight - 15, pipeWidth, 15); // Tepi atas

            // Pipa Bawah
            ctx.fillStyle = colors.body[0]; // Warna badan utama
            ctx.fillRect(x, canvas.height - bottomHeight + 15, pipeWidth, bottomHeight - 15); // Badan pipa bawah dikurangi tepinya
            ctx.fillStyle = colors.edge[0]; // Warna tepi
            ctx.fillRect(x, canvas.height - bottomHeight, pipeWidth, 15); // Tepi bawah

            // Tambahkan pola sederhana di atas warna solid
            ctx.fillStyle = 'rgba(0,0,0,0.1)'; // Overlay pola semi-transparan
            if (pattern === 'brick') {
                // Pola garis horizontal sederhana untuk bata
                for (let j = 0; j < topHeight - 15; j += 20) {
                    ctx.fillRect(x, j, pipeWidth, 2);
                }
                for (let j = canvas.height - bottomHeight + 15; j < canvas.height; j += 20) {
                    ctx.fillRect(x, j, pipeWidth, 2);
                }

            } else if (pattern === 'bamboo') {
                // Pola garis vertikal untuk bambu
                for (let j = 0; j < pipeWidth; j += 15) {
                    ctx.fillRect(x + j, 0, 2, topHeight - 15);
                    ctx.fillRect(x + j, canvas.height - bottomHeight + 15, 2, bottomHeight - 15);
                }
            } else if (pattern === 'wood') {
                // Pola garis diagonal untuk kayu
                for (let j = 0; j < pipeWidth; j += 15) {
                    ctx.beginPath();
                    ctx.moveTo(x + j, 0);
                    ctx.lineTo(x + j + 10, topHeight - 15);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(x + j, canvas.height - bottomHeight + 15);
                    ctx.lineTo(x + j + 10, canvas.height);
                    ctx.stroke();
                }
            } else if (pattern === 'stone') {
                 // Pola titik-titik untuk batu
                for (let j = 10; j < pipeWidth - 10; j += 15) {
                    for (let k = 10; k < topHeight - 25; k += 15) {
                        ctx.fillRect(x + j, k, 2, 2); // Titik-titik kecil
                    }
                    for (let k = canvas.height - bottomHeight + 25; k < canvas.height - 10; k += 15) {
                        ctx.fillRect(x + j, k, 2, 2); // Titik-titik kecil
                    }
                }
            }
        }

        drawSimplifiedPipe(pipes[i].x, pipes[i].top, pipes[i].bottom, colors.pattern);


        // Deteksi tabrakan (Sama seperti sebelumnya)
        if (
            bird.x + bird.width > pipes[i].x &&
            bird.x < pipes[i].x + 50 &&
            (
                (bird.y + bird.height > pipes[i].top && bird.y < pipes[i].top) ||
                (bird.y < canvas.height - pipes[i].bottom && bird.y + bird.height > canvas.height - pipes[i].bottom)
            )
        ) {
            gameOver = true;
            playSound(audioGameOver);
        }

        // Tambah skor (Sama seperti sebelumnya)
        if (pipes[i].x + 50 < bird.x && !pipes[i].scored) {
            score++;
            pipes[i].scored = true;
            playSound(audioScore);
            adjustDifficulty();
        }

        // Hapus pipa yang lewat (Sama seperti sebelumnya)
        if (pipes[i].x < -50) {
            pipes.splice(i, 1);
        }
    }
}

// Fungsi untuk menggambar skor (Sama seperti sebelumnya)
function drawScore() {
    ctx.fillStyle = "#000000";
    ctx.font = "30px Arial";
    ctx.fillText("Score: " + score, 10, 50);
}

// Fungsi untuk reset permainan (Sama seperti sebelumnya)
function resetGame() {
    bird.y = 150;
    bird.velocity = 0;
    pipes = [];
    score = 0;
    gameOver = false;
    isStartPlaying = true;
    jumpQueue = false;
    pipeSpeed = 1.5;
    pipeSpawnInterval = 150;
    pipeGap = 200;
    playSound(audioStart);
}

// Fungsi utama permainan (Sama seperti sebelumnya dengan sedikit perubahan)
function update() {
    if (gameOver) {
        ctx.fillStyle = "#000000";
        ctx.font = "40px Arial";
        ctx.fillText("Game Over", canvas.width / 2 - 100, canvas.height / 2);
        ctx.font = "20px Arial";
        ctx.fillText("Press R to Restart", canvas.width / 2 - 80, canvas.height / 2 + 40);
        return;
    }

    if (frameCount === 1) {
        isStartPlaying = true;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // Batas bawah dan atas (Sama seperti sebelumnya)
    if (bird.y + bird.height > canvas.height) {
        bird.y = canvas.height - bird.height;
        bird.velocity = 0;
        gameOver = true;
        playSound(audioGameOver);
    }
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }

    drawBird();
    drawPipes();
    drawScore();

    frameCount++;
    requestAnimationFrame(update);
}

// --- Inisialisasi permainan setelah gambar burung dimuat ---
birdImage.onload = function() {
    console.log("Gambar burung dimuat dengan sukses!");
    update();
};

birdImage.onerror = function() {
    console.error("Gagal memuat gambar burung! Periksa path file 'burung.png'.");
    birdImage.src = '';
    update();
};
--- END OF FILE game.js ---
