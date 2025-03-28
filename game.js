const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const restartButton = document.getElementById("restartButton");
const scoreDisplay = document.getElementById("finalScore");
const gameOverTextElement = document.getElementById("gameOverText");

const instructionsOverlay = document.getElementById("instructions");
const startButton = document.getElementById("startButton");
const jumpButton = document.getElementById("jumpButton"); // Get the new jump button

// Game Constants (No changes from previous A.3 stage)
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
const DIFFICULTY_INCREASE_FACTOR = 1.10;
const MIN_PIPE_SPAWN_INTERVAL = 60;

let dimensions = { width: 0, height: 0 };
let pipeGap = 0;

const updateDimensions = () => {
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;
    let targetHeight = availableHeight;
    let targetWidth = targetHeight * BASE_ASPECT_RATIO;
    if (targetWidth > availableWidth) {
        targetWidth = availableWidth;
        targetHeight = targetWidth / BASE_ASPECT_RATIO;
    }
    dimensions.width = Math.floor(Math.min(targetWidth, availableWidth));
    dimensions.height = Math.floor(Math.min(targetHeight, availableHeight));
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    pipeGap = dimensions.height * PIPE_GAP_RATIO;
    bird.width = dimensions.width * BIRD_WIDTH_RATIO;
    bird.height = dimensions.height * BIRD_HEIGHT_RATIO;
    console.log(`Canvas Dimensions Updated: ${dimensions.width}x${dimensions.height}`);
};

// Bird object
let bird = {
    x: 50, y: 150, width: 0, height: 0,
    gravity: BASE_GRAVITY, lift: BASE_LIFT, velocity: 0
};

// Game State
let pipes = []; let frameCount = 0; let score = 0; let gameOver = false;
let audioInitialized = false; let gameStarted = false; let pipeSpeed = BASE_PIPE_SPEED;
let pipeSpawnInterval = BASE_PIPE_SPAWN_INTERVAL; let animationId;

// Audio Elements (No changes)
const audioStart=new Audio('start.wav'); const audioJump=new Audio('jump.wav');
const audioScore=new Audio('score.wav'); const audioGameOver=new Audio('gameover.wav');
const audioSuccess=new Audio('success.mp3');
[audioStart,audioJump,audioScore,audioGameOver,audioSuccess].forEach(a=>{a.preload='auto';a.load();});
let isStartPlaying=false; let jumpQueue=false;

function playSound(audio){
    audio.currentTime=0; audio.play().catch(e=>{if(!audioInitialized){console.log("Audio interaction needed.",e.name);const i=()=>{audioInitialized=true;console.log("Audio context resumed.");audio.play().catch(r=>console.log("Retry failed: ",r));document.removeEventListener('keydown',i);canvas.removeEventListener('touchstart',i);jumpButton.removeEventListener('touchstart', i);};document.addEventListener('keydown',i,{once:true});canvas.addEventListener('touchstart',i,{once:true});jumpButton.addEventListener('touchstart', i, {once: true});}else{console.log("Audio play error: ",e);}}); // Added jumpButton listener for audio init
}
audioStart.onplaying=()=>{isStartPlaying=true;}; audioStart.onended=()=>{isStartPlaying=false;if(jumpQueue){playSound(audioJump);jumpQueue=false;}};

function handleJump(){
    if(!gameStarted||gameOver)return; bird.velocity=bird.lift;
    if(isStartPlaying){jumpQueue=true;}else{playSound(audioJump);}
}

// --- Event Listeners ---
// Keyboard
document.addEventListener("keydown", function(event) {
    if ((event.code==='Space'||event.code==='ShiftLeft'||event.code==='ShiftRight')&&!gameOver) {
        if(!gameStarted) startGame(); else handleJump();
    }
    if (event.key.toLowerCase()==="r"&&gameOver) resetGame();
});
// Canvas Touch
canvas.addEventListener("touchstart", function(event) {
    event.preventDefault(); // Still prevent default for canvas touches
    if (!gameOver) { if (!gameStarted) startGame(); else handleJump(); }
}, { passive: false });
// ** New Jump Button Listeners **
jumpButton.addEventListener('click', handleJump); // For mouse clicks
jumpButton.addEventListener('touchstart', function(event) {
    event.preventDefault(); // PREVENT subsequent 'click' event on touch devices
    handleJump();
}, { passive: false }); // Use passive: false if preventDefault is used


// Bird Drawing (No changes)
const birdImage=new Image(); birdImage.src='burung.png';
birdImage.onload=()=>console.log("Bird image loaded."); birdImage.onerror=()=>console.error("Failed to load bird image!");
function drawBird(){if(birdImage.complete&&birdImage.naturalWidth!==0){ctx.drawImage(birdImage,bird.x,bird.y,bird.width,bird.height);}else{ctx.fillStyle="#FFFF00";ctx.fillRect(bird.x,bird.y,bird.width,bird.height);}}

// --- Pipe Drawing Patterns --- (Brick pattern restored, others simplified - No changes here)
function drawBrickPattern(x,y,w,h){const bW=dimensions.width*0.05;const bH=dimensions.height*0.0234;const m=1;ctx.fillStyle='#FF6347';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#A0522D';ctx.lineWidth=m;let dM=true;for(let rY=y+bH;rY<y+h;rY+=bH){if(dM){ctx.beginPath();ctx.moveTo(x,rY);ctx.lineTo(x+w,rY);ctx.stroke();}}for(let r=0;r*bH<h;r++){const sY=y+r*bH;const eY=Math.min(sY+bH,y+h);const sO=(r%2===0)?0:bW/2;for(let cX=x+sO;cX<x+w;cX+=bW){if(dM&&cX>x&&cX<x+w){ctx.beginPath();ctx.moveTo(cX,sY);ctx.lineTo(cX,eY);ctx.stroke();}}}ctx.strokeStyle='#8B0000';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}
function drawBambooPattern(x,y,w,h){ctx.fillStyle='#228B22';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#006400';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
function drawWoodPattern(x,y,w,h){ctx.fillStyle='#8B4513';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#A0522D';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
function drawStonePattern(x,y,w,h){ctx.fillStyle='#A9A9A9';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#696969';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
// --- End Pipe Drawing Patterns ---

function getPipeStyle(){if(score<10)return'brick';if(score<20)return'bamboo';if(score<30)return'wood';return'stone';}

function adjustDifficulty(){if(score>10&&(score-1)%10===0){pipeSpeed*=DIFFICULTY_INCREASE_FACTOR;pipeSpawnInterval=Math.max(MIN_PIPE_SPAWN_INTERVAL,Math.round(pipeSpawnInterval/DIFFICULTY_INCREASE_FACTOR));console.log(`Difficulty+ S:${score} Spd:${pipeSpeed.toFixed(3)} Int:${pipeSpawnInterval}`);playSound(audioSuccess);}}

function drawPipes(){if(frameCount===FIRST_PIPE_SPAWN_FRAME||(frameCount>FIRST_PIPE_SPAWN_FRAME&&(frameCount-FIRST_PIPE_SPAWN_FRAME)%pipeSpawnInterval===0)){const minH=50;const maxH=canvas.height-pipeGap-minH;let tH=Math.max(minH,Math.random()*maxH);pipes.push({x:canvas.width,topHeight:tH,scored:false});}const pW=dimensions.width*PIPE_WIDTH_RATIO;const sty=getPipeStyle();for(let i=pipes.length-1;i>=0;i--){const p=pipes[i];p.x-=pipeSpeed;const bY=p.topHeight+pipeGap;const bH=canvas.height-bY;let dF;switch(sty){case'bamboo':dF=drawBambooPattern;break;case'wood':dF=drawWoodPattern;break;case'stone':dF=drawStonePattern;break;default:dF=drawBrickPattern;break;}dF(p.x,0,pW,p.topHeight);dF(p.x,bY,pW,bH);if(bird.x<p.x+pW&&bird.x+bird.width>p.x&&(bird.y<p.topHeight||bird.y+bird.height>bY)){triggerGameOver();return;}if(!p.scored&&p.x+pW<bird.x){score++;p.scored=true;playSound(audioScore);adjustDifficulty();}if(p.x+pW<0)pipes.splice(i,1);}}

function drawScore(){ctx.fillStyle="#FFF";ctx.font=`bold ${Math.max(24,dimensions.height*0.05)}px Arial`;ctx.textAlign="left";ctx.textBaseline="top";ctx.shadowColor="rgba(0,0,0,0.5)";ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;ctx.shadowBlur=3;ctx.fillText("Skor: "+score,10,10);ctx.shadowColor="transparent";ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.shadowBlur=0;}

function triggerGameOver(){
    if(gameOver)return;gameOver=true;playSound(audioGameOver);cancelAnimationFrame(animationId);
    scoreDisplay.textContent=score;gameOverOverlay.style.display="flex";
    jumpButton.style.display = 'none'; // Hide jump button on game over
}

function update(){if(gameOver)return;ctx.clearRect(0,0,canvas.width,canvas.height);bird.velocity+=bird.gravity;bird.y+=bird.velocity;if(bird.y+bird.height>canvas.height){bird.y=canvas.height-bird.height;bird.velocity=0;triggerGameOver();return;}if(bird.y<0){bird.y=0;bird.velocity=0;}drawPipes();if(gameOver)return;drawBird();drawScore();frameCount++;animationId=requestAnimationFrame(update);}

function resetGame(){
    canvas.style.display='none'; // Hide canvas
    instructionsOverlay.style.display='flex'; // Show instructions
    gameOverOverlay.style.display='none';
    jumpButton.style.display = 'none'; // Hide jump button

    bird.y=dimensions.height/4;bird.velocity=0;bird.gravity=BASE_GRAVITY;bird.lift=BASE_LIFT;
    pipes=[];score=0;gameOver=false;gameStarted=false;frameCount=0;
    pipeSpeed=BASE_PIPE_SPEED;pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL;
    isStartPlaying=false;jumpQueue=false;

    cancelAnimationFrame(animationId);
    console.log("Game Reset - Canvas hidden, Jump Button hidden");
}

function startGame(){
    if(gameStarted)return;
    // updateDimensions(); // Recalculate dimensions just in case before starting

    instructionsOverlay.style.display='none'; // Hide instructions
    canvas.style.display='block'; // Show canvas
    jumpButton.style.display = 'block'; // Show jump button

    bird.gravity=BASE_GRAVITY;bird.lift=BASE_LIFT;
    pipeSpeed=BASE_PIPE_SPEED;pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL;
    frameCount=0; bird.y=dimensions.height/4; bird.velocity=0;

    if(!audioInitialized){playSound(audioStart);audioInitialized=true;}else{playSound(audioStart);}
    gameStarted=true; gameOver=false;

    console.log("Game Starting - Canvas shown, Jump Button shown");
    update();
}

// Initial Setup & Event Listeners
startButton.addEventListener('click',startGame);
restartButton.addEventListener('click',resetGame);

window.addEventListener('load',()=>{console.log("Window loaded, setting initial dimensions.");updateDimensions();instructionsOverlay.style.display='flex';canvas.style.display='none';jumpButton.style.display = 'none';}); // Ensure correct initial state

const resizeObserver=new ResizeObserver(e=>{if(e[0]){console.log("Resize detected, updating dimensions.");updateDimensions();if(!gameStarted||gameOver){bird.y=dimensions.height/4;}if(!gameStarted&&!gameOver){}else if(gameOver){}}});
resizeObserver.observe(document.body);window.addEventListener('resize',updateDimensions);
window.addEventListener('keydown',function(e){if(e.code==='Space'&&e.target==document.body)e.preventDefault();});