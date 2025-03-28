const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const restartButton = document.getElementById("restartButton");
const scoreDisplay = document.getElementById("finalScore");
const gameOverTextElement = document.getElementById("gameOverText");

const instructionsOverlay = document.getElementById("instructions");
const startButton = document.getElementById("startButton");
const jumpButton = document.getElementById("jumpButton");

// Game Constants
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
const DIFFICULTY_INCREASE_FACTOR = 1.20; // Difficulty increases by 20% now
const MIN_PIPE_SPAWN_INTERVAL = 60; // Keep a minimum interval

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

// Audio Elements
const audioStart=new Audio('start.wav'); const audioJump=new Audio('jump.wav');
const audioScore=new Audio('score.wav'); const audioGameOver=new Audio('gameover.wav');
const audioSuccess=new Audio('success.mp3');
[audioStart,audioJump,audioScore,audioGameOver,audioSuccess].forEach(a=>{a.preload='auto';a.load();});
let isStartPlaying=false; let jumpQueue=false;

function playSound(audio){
    audio.currentTime=0; audio.play().catch(e=>{if(!audioInitialized){console.log("Audio interaction needed.",e.name);const i=()=>{audioInitialized=true;console.log("Audio context resumed.");audio.play().catch(r=>console.log("Retry failed: ",r));document.removeEventListener('keydown',i);canvas.removeEventListener('touchstart',i);jumpButton.removeEventListener('touchstart', i);};document.addEventListener('keydown',i,{once:true});canvas.addEventListener('touchstart',i,{once:true});jumpButton.addEventListener('touchstart', i, {once: true});}else{console.log("Audio play error: ",e);}});
}
audioStart.onplaying=()=>{isStartPlaying=true;}; audioStart.onended=()=>{isStartPlaying=false;if(jumpQueue){playSound(audioJump);jumpQueue=false;}};

function handleJump(){ if(!gameStarted||gameOver)return; bird.velocity=bird.lift; if(isStartPlaying){jumpQueue=true;}else{playSound(audioJump);}}

// --- Event Listeners ---
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

// ** Updated Stone Pattern **
function drawStonePattern(x, y, width, height) {
    const baseColors = ['#A9A9A9', '#808080', '#696969', '#BEBEBE']; // Shades of gray
    const stoneCount = Math.max(5, Math.floor((width * height) / 1500)); // Adjust density based on area

    // Draw a base slightly darker color
    ctx.fillStyle = baseColors[1];
    ctx.fillRect(x, y, width, height);

    for (let i = 0; i < stoneCount; i++) {
        // Random position within the pipe section
        const stoneX = x + Math.random() * width;
        const stoneY = y + Math.random() * height;

        // Random size for the stone (elliptical)
        const stoneWidth = (15 + Math.random() * 25) * (dimensions.width / 480); // Scale size slightly with canvas width
        const stoneHeight = (10 + Math.random() * 20) * (dimensions.height / 640); // Scale size slightly with canvas height
        const rotation = Math.random() * Math.PI * 2; // Random rotation

        // Random color from the palette
        ctx.fillStyle = baseColors[Math.floor(Math.random() * baseColors.length)];

        // Draw the ellipse
        ctx.beginPath();
        ctx.ellipse(stoneX, stoneY, stoneWidth / 2, stoneHeight / 2, rotation, 0, 2 * Math.PI);
        ctx.fill();

        // Optional: Add a subtle darker stroke for definition
        // ctx.strokeStyle = '#505050'; // Darker gray
        // ctx.lineWidth = 0.5;
        // ctx.stroke();
    }
     // Draw outer border for the whole pipe section
    ctx.strokeStyle = '#404040'; // Even darker border
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
}
// --- End Pipe Drawing Patterns ---

// ** Updated Pipe Style Logic **
function getPipeStyle() {
    if (score < 10) return 'brick'; // 0-9
    if (score < 20) return 'stone'; // 10-19 << NEW
    if (score < 30) return 'bamboo'; // 20-29
    return 'wood';                // 30+
}

// ** Updated Difficulty Adjustment **
function adjustDifficulty() {
    // Increase difficulty by 20% when score crosses a multiple of 10 (11, 21, 31...)
    if (score > 10 && (score - 1) % 10 === 0) {
        pipeSpeed *= DIFFICULTY_INCREASE_FACTOR; // Use 1.20 factor
        pipeSpawnInterval = Math.max(MIN_PIPE_SPAWN_INTERVAL, Math.round(pipeSpawnInterval / DIFFICULTY_INCREASE_FACTOR)); // Reduce interval more
        console.log(`Difficulty++ S:${score} Spd:${pipeSpeed.toFixed(3)} Int:${pipeSpawnInterval}`);
        playSound(audioSuccess); // Play sound on difficulty increase
    }
}

function drawPipes(){if(frameCount===FIRST_PIPE_SPAWN_FRAME||(frameCount>FIRST_PIPE_SPAWN_FRAME&&(frameCount-FIRST_PIPE_SPAWN_FRAME)%pipeSpawnInterval===0)){const minH=50;const maxH=canvas.height-pipeGap-minH;let tH=Math.max(minH,Math.random()*maxH);pipes.push({x:canvas.width,topHeight:tH,scored:false});}const pW=dimensions.width*PIPE_WIDTH_RATIO;const sty=getPipeStyle();for(let i=pipes.length-1;i>=0;i--){const p=pipes[i];p.x-=pipeSpeed;const bY=p.topHeight+pipeGap;const bH=canvas.height-bY;let dF;switch(sty){case'stone':dF=drawStonePattern;break; case'bamboo':dF=drawBambooPattern;break;case'wood':dF=drawWoodPattern;break;default:dF=drawBrickPattern;break;} /* Updated switch order */ dF(p.x,0,pW,p.topHeight);dF(p.x,bY,pW,bH);if(bird.x<p.x+pW&&bird.x+bird.width>p.x&&(bird.y<p.topHeight||bird.y+bird.height>bY)){triggerGameOver();return;}if(!p.scored&&p.x+pW<bird.x){score++;p.scored=true;playSound(audioScore);adjustDifficulty();}if(p.x+pW<0)pipes.splice(i,1);}}

function drawScore(){ctx.fillStyle="#FFF";ctx.font=`bold ${Math.max(24,dimensions.height*0.05)}px Arial`;ctx.textAlign="left";ctx.textBaseline="top";ctx.shadowColor="rgba(0,0,0,0.5)";ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;ctx.shadowBlur=3;ctx.fillText("Skor: "+score,10,10);ctx.shadowColor="transparent";ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.shadowBlur=0;}

function triggerGameOver(){if(gameOver)return;gameOver=true;playSound(audioGameOver);cancelAnimationFrame(animationId);scoreDisplay.textContent=score;gameOverOverlay.style.display="flex";jumpButton.style.display='none';}

function update(){if(gameOver)return;ctx.clearRect(0,0,canvas.width,canvas.height);bird.velocity+=bird.gravity;bird.y+=bird.velocity;if(bird.y+bird.height>canvas.height){bird.y=canvas.height-bird.height;bird.velocity=0;triggerGameOver();return;}if(bird.y<0){bird.y=0;bird.velocity=0;}drawPipes();if(gameOver)return;drawBird();drawScore();frameCount++;animationId=requestAnimationFrame(update);}

function resetGame(){canvas.style.display='none';instructionsOverlay.style.display='flex';gameOverOverlay.style.display='none';jumpButton.style.display='none';bird.y=dimensions.height/4;bird.velocity=0;bird.gravity=BASE_GRAVITY;bird.lift=BASE_LIFT;pipes=[];score=0;gameOver=false;gameStarted=false;frameCount=0;pipeSpeed=BASE_PIPE_SPEED;pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL;isStartPlaying=false;jumpQueue=false;cancelAnimationFrame(animationId);console.log("Game Reset (A.4)");}

function startGame(){if(gameStarted)return;instructionsOverlay.style.display='none';canvas.style.display='block';jumpButton.style.display='block';bird.gravity=BASE_GRAVITY;bird.lift=BASE_LIFT;pipeSpeed=BASE_PIPE_SPEED;pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL;frameCount=0;bird.y=dimensions.height/4;bird.velocity=0;if(!audioInitialized){playSound(audioStart);audioInitialized=true;}else{playSound(audioStart);}gameStarted=true;gameOver=false;console.log("Game Starting (A.4)");update();}

// Initial Setup & Event Listeners
startButton.addEventListener('click',startGame);
restartButton.addEventListener('click',resetGame);

// Use setTimeout to slightly delay initial dimension calculation
window.addEventListener('load',()=>{
    console.log("Window loaded, delaying initial dimension update slightly.");
    setTimeout(() => {
        console.log("Running delayed initial dimension update.");
        updateDimensions();
        // Ensure initial visibility state is correct AFTER dimensions are set
        instructionsOverlay.style.display = 'flex';
        canvas.style.display = 'none';
        jumpButton.style.display = 'none';
        // Set bird start pos only after dimensions known, but before game starts drawing
        bird.y = dimensions.height / 4;
    }, 50); // Delay by 50ms (adjust if needed)
});

const resizeObserver=new ResizeObserver(e=>{if(e[0]){console.log("Resize detected, updating dimensions.");updateDimensions();if(!gameStarted||gameOver){bird.y=dimensions.height/4;}if(!gameStarted&&!gameOver){}else if(gameOver){}}});
resizeObserver.observe(document.body);window.addEventListener('resize',updateDimensions);
window.addEventListener('keydown',function(e){if(e.code==='Space'&&e.target==document.body)e.preventDefault();});