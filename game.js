const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Mengatur ukuran canvas sesuai layar HP
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Objek burung
const bird = {
    x: 50,
    y: canvas.height / 2,
    width: 20,
    height: 20,
    velocity: 0,
    gravity: 0.5,
    lift: -10
};

// Array untuk pipa dan variabel permainan
const pipes = [];
const pipeWidth = 50;
const pipeGap = 150;
const pipeFrequency = 150; // Frekuensi munculnya pipa (dalam frame)
let frameCount = 0;
let score = 0;
let gameOver = false;

// Event sentuhan untuk mengontrol burung dan restart
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault(); // Mencegah scroll saat disentuh
    if (!gameOver) {
        bird.velocity = bird.lift; // Burung meloncat saat disentuh
    } else {
        // Restart game
        bird.y = canvas.height / 2;
        bird.velocity = 0;
        pipes.length = 0;
        score = 0;
        gameOver = false;
    }
});

// Fungsi untuk memperbarui logika game
function update() {
    if (gameOver) return;

    // Gerakan burung
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // Batasi burung agar tidak keluar layar atas
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }

    // Cek jika burung menyentuh tanah
    if (bird.y + bird.height > canvas.height) {
        gameOver = true;
    }

    // Membuat pipa baru
    frameCount++;
    if (frameCount % pipeFrequency === 0) {
        const pipeHeight = Math.random() * (canvas.height - pipeGap);
        pipes.push({
            x: canvas.width,
            top: pipeHeight,
            bottom: canvas.height - pipeHeight - pipeGap,
            passed: false
        });
    }

    // Menggerakkan pipa dan cek tabrakan
    pipes.forEach(pipe => {
        pipe.x -= 2; // Pipa bergerak ke kiri

        // Deteksi tabrakan dengan burung
        if (
            bird.x + bird.width > pipe.x &&
            bird.x < pipe.x + pipeWidth &&
            (bird.y < pipe.top || bird.y + bird.height > canvas.height - pipe.bottom)
        ) {
            gameOver = true;
        }

        // Tambah skor jika burung melewati pipa
        if (pipe.x + pipeWidth < bird.x && !pipe.passed) {
            pipe.passed = true;
            score++;
        }
    });

    // Hapus pipa yang sudah keluar layar
    pipes = pipes.filter(pipe => pipe.x + pipeWidth > 0);
}

// Fungsi untuk menggambar elemen game
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gambar burung
    ctx.fillStyle = 'yellow';
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);

    // Gambar pipa
    ctx.fillStyle = 'green';
    pipes.forEach(pipe => {
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.top); // Pipa atas
        ctx.fillRect(pipe.x, canvas.height - pipe.bottom, pipeWidth, pipe.bottom); // Pipa bawah
    });

    // Tampilkan skor
    ctx.fillStyle = 'black';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);

    // Tampilkan pesan game over
    if (gameOver) {
        ctx.fillStyle = 'red';
        ctx.font = '48px Arial';
        ctx.fillText('Game Over', canvas.width / 2 - 100, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Tap to Restart', canvas.width / 2 - 70, canvas.height / 2 + 30);
    }
}

// Loop utama game
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Mulai game
gameLoop();