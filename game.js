const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const restartButton = document.getElementById("restartButton");
const scoreDisplay = document.getElementById("finalScore");
const gameOverTextElement = document.getElementById("gameOverText");

const instructionsOverlay = document.getElementById("instructions");
const startButton = document.getElementById("startButton");
const jumpButton = document.getElementById("jumpButton");

// Game Constants (No physics changes in A.6)
const BASE_ASPECT_RATIO = 480 / 640;
const BIRD_WIDTH_RATIO = 0.125;
const BIRD_HEIGHT_RATIO = 0.0625;
const PIPE_WIDTH_RATIO = 0.1248;
const BASE_GRAVITY = 0.09072;
const BASE_LIFT = -2.1504;
const BASE_PIPE_SPEED = 0.5;
const BASE_PIPE_SPAWN_INTERVAL = 450;
const FIRST_PIPE_SPAWN_FRAME = 79;
const PIPE_GAP_RATIO = (1 / 3) * 0.75;
const DIFFICULTY_INCREASE_FACTOR = 1.20; // 20% increase
const MIN_PIPE_SPAWN_INTERVAL = 60;

// Particle System Constants
const PARTICLE_GRAVITY = 0.05;
const PARTICLE_DRAG = 0.99;
const PARTICLE_FADE = 0.98;

let dimensions = { width: 0, height: 0 };
let pipeGap = 0;

const updateDimensions = () => {
    const availableWidth = window.innerWidth; const availableHeight = window.innerHeight;
    let targetHeight = availableHeight; let targetWidth = targetHeight * BASE_ASPECT_RATIO;
    if (targetWidth > availableWidth) { targetWidth = availableWidth; targetHeight = targetWidth / BASE_ASPECT_RATIO; }
    dimensions.width = Math.floor(Math.min(targetWidth, availableWidth)); dimensions.height = Math.floor(Math.min(targetHeight, availableHeight));
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    pipeGap = dimensions.height * PIPE_GAP_RATIO;
    bird.width = dimensions.width * BIRD_WIDTH_RATIO; bird.height = dimensions.height * BIRD_HEIGHT_RATIO;
    console.log(`Canvas Dimensions Updated: ${dimensions.width}x${dimensions.height}`);
};

// Bird object
let bird = { x: 50, y: 150, width: 0, height: 0, gravity: BASE_GRAVITY, lift: BASE_LIFT, velocity: 0 };

// Game State
let pipes = []; let frameCount = 0; let score = 0; let gameOver = false;
let audioInitialized = false; let gameStarted = false; let pipeSpeed = BASE_PIPE_SPEED;
let pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL; let animationId;
let particles = []; // Particle system array

// Audio Elements
const audioStart=new Audio('start.wav'); const audioJump=new Audio('jump.wav');
const audioScore=new Audio('score.wav'); const audioGameOver=new Audio('gameover.wav');
const audioSuccess=new Audio('success.mp3');
[audioStart,audioJump,audioScore,audioGameOver,audioSuccess].forEach(a=>{a.preload='auto';a.load();});
let isStartPlaying=false; let jumpQueue=false;

function playSound(audio){ audio.currentTime=0; audio.play().catch(e=>{if(!audioInitialized){console.log("Audio interaction needed.",e.name);const i=()=>{audioInitialized=true;console.log("Audio context resumed.");audio.play().catch(r=>console.log("Retry failed: ",r));document.removeEventListener('keydown',i);canvas.removeEventListener('touchstart',i);jumpButton.removeEventListener('touchstart', i);};document.addEventListener('keydown',i,{once:true});canvas.addEventListener('touchstart',i,{once:true});jumpButton.addEventListener('touchstart', i, {once: true});}else{console.log("Audio play error: ",e);}}); }
audioStart.onplaying=()=>{isStartPlaying=true;}; audioStart.onended=()=>{isStartPlaying=false;if(jumpQueue){playSound(audioJump);jumpQueue=false;}};

// --- Particle Functions ---
function createParticles(count, x, y, type) {
    for (let i = 0; i < count; i++) {
        let p = { x: x, y: y, vx: 0, vy: 0, size: 0, color: 'white', life: 1.0 };
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 2 + 1;

        switch (type) {
            case 'jump':
                p.vx = (Math.random() - 0.5) * 3;
                p.vy = -Math.random() * 1.5 - 1;
                p.color = Math.random() > 0.3 ? '#FFFF99' : '#FFFFFF';
                // ** Reduced Size: Original was Math.random() * 4 + 3 (range 3-7)
                // ** New size is 20% of that: range approx 0.6 - 1.4
                p.size = Math.random() * 0.8 + 0.6; // Significantly smaller
                p.life = 0.6;
                break;
            case 'score':
                p.vx = (Math.random() - 0.5) * 1;
                p.vy = -Math.random() * 0.5 - 0.2;
                p.color = Math.random() > 0.5 ? '#FFD700' : '#FFFFFF';
                p.size = Math.random() * 2 + 3;
                p.life = 0.7;
                break;
            case 'hit':
                p.vx = Math.cos(angle) * speed * 1.5;
                p.vy = Math.sin(angle) * speed * 1.5;
                const hitColors = ['#FF4500', '#FFA500', '#FFFFFF', '#FFD700', '#DC143C'];
                p.color = hitColors[Math.floor(Math.random() * hitColors.length)];
                p.size = Math.random() * 5 + 2;
                p.life = 1.0;
                break;
        }
        particles.push(p);
    }
}
function updateParticles(){for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.vy+=PARTICLE_GRAVITY;p.vx*=PARTICLE_DRAG;p.x+=p.vx;p.y+=p.vy;p.life*=PARTICLE_FADE;if(p.life<=0.05){particles.splice(i,1);}}}
function drawParticles(){for(let i=0;i<particles.length;i++){let p=particles[i];ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}ctx.globalAlpha=1.0;}
// --- End Particle Functions ---

function handleJump(){ if(!gameStarted||gameOver)return; bird.velocity=bird.lift; createParticles(5, bird.x + bird.width / 2, bird.y + bird.height, 'jump'); /* Reduced particle count for smaller effect */ if(isStartPlaying){jumpQueue=true;}else{playSound(audioJump);}}

// Event Listeners
document.addEventListener("keydown", function(e){if((e.code==='Space'||e.code==='ShiftLeft'||e.code==='ShiftRight')&&!gameOver){if(!gameStarted)startGame();else handleJump();}if(e.key.toLowerCase()==="r"&&gameOver)resetGame();});
canvas.addEventListener("touchstart", function(e){e.preventDefault();if(!gameOver){if(!gameStarted)startGame();else handleJump();}},{passive:false});
jumpButton.addEventListener('click',handleJump); jumpButton.addEventListener('touchstart',function(e){e.preventDefault();handleJump();},{passive:false});

// Bird Drawing
const birdImage=new Image(); birdImage.src='burung.png';
birdImage.onload=()=>console.log("Bird image loaded."); birdImage.onerror=()=>console.error("Failed to load bird image!");
function drawBird(){if(birdImage.complete&&birdImage.naturalWidth!==0){ctx.drawImage(birdImage,bird.x,bird.y,bird.width,bird.height);}else{ctx.fillStyle="#FFFF00";ctx.fillRect(bird.x,bird.y,bird.width,bird.height);}}

// --- Pipe Drawing Patterns ---
function drawBrickPattern(x,y,w,h){const bW=dimensions.width*0.05;const bH=dimensions.height*0.0234;const m=1;ctx.fillStyle='#FF6347';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#A0522D';ctx.lineWidth=m;let dM=true;for(let rY=y+bH;rY<y+h;rY+=bH){if(dM){ctx.beginPath();ctx.moveTo(x,rY);ctx.lineTo(x+w,rY);ctx.stroke();}}for(let r=0;r*bH<h;r++){const sY=y+r*bH;const eY=Math.min(sY+bH,y+h);const sO=(r%2===0)?0:bW/2;for(let cX=x+sO;cX<x+w;cX+=bW){if(dM&&cX>x&&cX<x+w){ctx.beginPath();ctx.moveTo(cX,sY);ctx.lineTo(cX,eY);ctx.stroke();}}}ctx.strokeStyle='#8B0000';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}
function drawBambooPattern(x,y,w,h){ctx.fillStyle='#228B22';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#006400';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
function drawWoodPattern(x,y,w,h){ctx.fillStyle='#8B4513';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#A0522D';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}

// ** NEW Brown Squares Pattern (Replaces Stone) **
function drawBrownSquaresPattern(x, y, width, height) {
    const baseColor = '#A0522D'; // Sienna base
    const squareColor = '#8B4513'; // SaddleBrown squares
    const borderColor = '#5C4033'; // Dark brown border
    const squareSize = Math.max(8, Math.min(width, height) * 0.12); // Size relative to pipe dimensions, with minimum
    const gap = 2; // Gap between squares

    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = squareColor;
    for (let rowY = y + gap; rowY < y + height - gap; rowY += squareSize + gap) {
        for (let colX = x + gap; colX < x + width - gap; colX += squareSize + gap) {
            // Ensure square doesn't overflow bounds due to partial fit
            const currentSquareWidth = Math.min(squareSize, x + width - colX - gap);
            const currentSquareHeight = Math.min(squareSize, y + height - rowY - gap);
            if (currentSquareWidth > 0 && currentSquareHeight > 0) {
                ctx.fillRect(colX, rowY, currentSquareWidth, currentSquareHeight);
            }
        }
    }

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
}
// --- End Pipe Drawing Patterns ---

// ** Updated Pipe Style Logic **
function getPipeStyle() {
    if (score < 10) return 'brick';        // 0-9
    if (score < 20) return 'brownSquares'; // 10-19 << NEW STYLE NAME
    if (score < 30) return 'bamboo';       // 20-29
    return 'wood';                       // 30+
}

// Updated Difficulty Adjustment (Factor 1.20)
function adjustDifficulty(){ if(score>10&&(score-1)%10===0){ pipeSpeed*=DIFFICULTY_INCREASE_FACTOR; pipeSpawnInterval=Math.max(MIN_PIPE_SPAWN_INTERVAL,Math.round(pipeSpawnInterval/DIFFICULTY_INCREASE_FACTOR)); console.log(`Difficulty++ S:${score} Spd:${pipeSpeed.toFixed(3)} Int:${pipeSpawnInterval}`); playSound(audioSuccess); } }

function drawPipes() {
    // Spawn logic - No stoneData generation needed anymore
    if (frameCount === FIRST_PIPE_SPAWN_FRAME || (frameCount > FIRST_PIPE_SPAWN_FRAME && (frameCount - FIRST_PIPE_SPAWN_FRAME) % pipeSpawnInterval === 0)) {
        const minH = 50; const maxH = canvas.height - pipeGap - minH;
        let tH = Math.max(minH, Math.random() * maxH);
        pipes.push({ x: canvas.width, topHeight: tH, scored: false }); // Removed stoneData
    }

    const pW = dimensions.width * PIPE_WIDTH_RATIO;
    const currentStyle = getPipeStyle(); // Get style based on CURRENT score

    for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i]; p.x -= pipeSpeed;
        const bY = p.topHeight + pipeGap; const bH = canvas.height - bY;
        let dF;
        // Select drawing function based on CURRENT style
        switch(currentStyle){
            case 'brownSquares': dF = drawBrownSquaresPattern; break; // Use new function
            case 'bamboo': dF = drawBambooPattern; break;
            case 'wood': dF = drawWoodPattern; break;
            default: dF = drawBrickPattern; break;
        }

        // Draw pipes using the selected function (No special handling needed)
        dF(p.x, 0, pW, p.topHeight);
        dF(p.x, bY, pW, bH);

        // Collision, Scoring, Removal (No changes needed here)
        if(bird.x<p.x+pW&&bird.x+bird.width>p.x&&(bird.y<p.topHeight||bird.y+bird.height>bY)){triggerGameOver();return;}
        if(!p.scored&&p.x+pW<bird.x){ score++; p.scored=true; playSound(audioScore); createParticles(5, p.x + pW, p.topHeight + pipeGap / 2, 'score'); adjustDifficulty(); }
        if(p.x+pW<0)pipes.splice(i,1);
    }
}

function drawScore(){ctx.fillStyle="#FFF";ctx.font=`bold ${Math.max(24,dimensions.height*0.05)}px Arial`;ctx.textAlign="left";ctx.textBaseline="top";ctx.shadowColor="rgba(0,0,0,0.5)";ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;ctx.shadowBlur=3;ctx.fillText("Skor: "+score,10,10);ctx.shadowColor="transparent";ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.shadowBlur=0;}

function triggerGameOver(){ if(gameOver)return; gameOver=true; playSound(audioGameOver); if(navigator.vibrate){navigator.vibrate(150);} createParticles(30, bird.x + bird.width / 2, bird.y + bird.height / 2, 'hit'); cancelAnimationFrame(animationId); scoreDisplay.textContent=score; gameOverOverlay.style.display="flex"; jumpButton.style.display='none'; }

function update(){
    if(gameOver)return; ctx.clearRect(0,0,canvas.width,canvas.height);
    bird.velocity+=bird.gravity; bird.y+=bird.velocity;
    if(bird.y+bird.height>canvas.height){bird.y=canvas.height-bird.height;bird.velocity=0;triggerGameOver();return;}
    if(bird.y<0){bird.y=0;bird.velocity=0;}
    updateParticles(); // Update particle physics
    drawPipes(); if(gameOver)return;
    drawBird();
    drawParticles(); // Draw particles on top
    drawScore();
    frameCount++; animationId=requestAnimationFrame(update);
}

function resetGame(){ canvas.style.display='none'; instructionsOverlay.style.display='flex'; gameOverOverlay.style.display='none'; jumpButton.style.display='none'; bird.y=dimensions.height/4; bird.velocity=0; bird.gravity=BASE_GRAVITY; bird.lift=BASE_LIFT; pipes=[]; score=0; gameOver=false; gameStarted=false; frameCount=0; pipeSpeed=BASE_PIPE_SPEED; pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL; isStartPlaying=false; jumpQueue=false; particles=[]; cancelAnimationFrame(animationId); console.log("Game Reset (A.6)"); }

function startGame(){
    if(gameStarted)return;
    updateDimensions(); // Calculate dimensions on start
    instructionsOverlay.style.display='none'; canvas.style.display='block'; jumpButton.style.display='block';
    bird.gravity=BASE_GRAVITY; bird.lift=BASE_LIFT; pipeSpeed=BASE_PIPE_SPEED; pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL;
    frameCount=0; bird.y=dimensions.height/4; bird.velocity=0;
    pipes=[]; particles=[]; score=0; // Reset game state variables
    if(!audioInitialized){playSound(audioStart);audioInitialized=true;}else{playSound(audioStart);}
    gameStarted=true; gameOver=false; console.log("Game Starting (A.6)");
    update();
}

// Initial Setup & Event Listeners
startButton.addEventListener('click',startGame);
restartButton.addEventListener('click',resetGame);

window.addEventListener('load',()=>{ console.log("Window loaded. Initial state set by CSS."); instructionsOverlay.style.display='flex'; canvas.style.display='none'; jumpButton.style.display='none'; /* Don't call updateDimensions here */ });
const resizeObserver=new ResizeObserver(e=>{if(e[0]){console.log("Resize detected, updating dimensions.");updateDimensions();if(!gameStarted||gameOver){bird.y=dimensions.height/4;}if(!gameStarted&&!gameOver){}else if(gameOver){}}});
resizeObserver.observe(document.body);window.addEventListener('resize',updateDimensions);
window.addEventListener('keydown',function(e){if(e.code==='Space'&&e.target==document.body)e.preventDefault();});