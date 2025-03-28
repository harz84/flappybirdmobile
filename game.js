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
const DIFFICULTY_INCREASE_FACTOR = 1.20; // 20% increase
const MIN_PIPE_SPAWN_INTERVAL = 60;

// --- Particle System Constants ---
const PARTICLE_GRAVITY = 0.05; // How fast particles fall
const PARTICLE_DRAG = 0.99; // Slows down particles horizontally
const PARTICLE_FADE = 0.98; // How quickly particles fade (used for alpha or life)

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

// --- Particle System Array ---
let particles = [];

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
        let p = {
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            size: Math.random() * 3 + 2, // Size between 2 and 5
            color: 'white',
            life: 1.0 // Represents full life/alpha
        };

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1; // Base speed

        switch (type) {
            case 'jump':
                // Upward and outward burst, yellow/white
                p.vx = (Math.random() - 0.5) * 3; // More horizontal spread
                p.vy = -Math.random() * 1.5 - 1; // Primarily upward
                p.color = Math.random() > 0.3 ? '#FFFF99' : '#FFFFFF'; // Pale yellow or white
                p.size = Math.random() * 4 + 3; // Slightly larger jump particles
                p.life = 0.6; // Shorter life
                break;
            case 'score':
                // Small stars moving slightly up/out, gold/white
                p.vx = (Math.random() - 0.5) * 1;
                p.vy = -Math.random() * 0.5 - 0.2;
                p.color = Math.random() > 0.5 ? '#FFD700' : '#FFFFFF'; // Gold or white
                p.size = Math.random() * 2 + 3; // Star-like size
                p.life = 0.7;
                // Add star-like drawing? For simplicity, keep as squares/circles
                break;
            case 'hit':
                // Explosion outwards, red/orange/white/yellow
                p.vx = Math.cos(angle) * speed * 1.5; // Faster explosion
                p.vy = Math.sin(angle) * speed * 1.5;
                const hitColors = ['#FF4500', '#FFA500', '#FFFFFF', '#FFD700', '#DC143C']; // Red, orange, white, gold, crimson
                p.color = hitColors[Math.floor(Math.random() * hitColors.length)];
                p.size = Math.random() * 5 + 2; // Variable explosion size
                p.life = 1.0; // Longer life for explosion
                break;
        }
        particles.push(p);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.vy += PARTICLE_GRAVITY; // Apply gravity
        p.vx *= PARTICLE_DRAG;    // Apply drag
        p.x += p.vx;
        p.y += p.vy;
        p.life *= PARTICLE_FADE; // Reduce life/alpha

        // Remove faded particles
        if (p.life <= 0.05) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        ctx.globalAlpha = p.life; // Use life for transparency
        ctx.fillStyle = p.color;
        // Simple square particles
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1.0; // Reset global alpha
}
// --- End Particle Functions ---


function handleJump(){ if(!gameStarted||gameOver)return; bird.velocity=bird.lift; createParticles(8, bird.x + bird.width / 2, bird.y + bird.height, 'jump'); /* More jump particles from bottom */ if(isStartPlaying){jumpQueue=true;}else{playSound(audioJump);}}

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

// ** Updated Stone Pattern with Saved Data **
function drawStonePattern(x, y, width, height, stoneData) { // Accept stoneData
    const baseColors = ['#A9A9A9', '#808080', '#696969', '#BEBEBE'];
    ctx.fillStyle = baseColors[1]; // Base color
    ctx.fillRect(x, y, width, height);

    if (!stoneData) return; // Should not happen if generated correctly

    // Draw stones based on saved data
    for (let i = 0; i < stoneData.length; i++) {
        const stone = stoneData[i];
        ctx.fillStyle = baseColors[stone.colorIndex];
        ctx.beginPath();
        // Use absolute pipe position (x, y) + relative stone offset
        ctx.ellipse(x + stone.xOffset, y + stone.yOffset, stone.width / 2, stone.height / 2, stone.rotation, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.strokeStyle = '#404040'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);
}
// --- End Pipe Drawing Patterns ---

function getPipeStyle(){ if(score<10)return'brick';if(score<20)return'stone';if(score<30)return'bamboo';return'wood'; }

// Updated Difficulty Adjustment (Factor 1.20)
function adjustDifficulty(){ if(score>10&&(score-1)%10===0){ pipeSpeed*=DIFFICULTY_INCREASE_FACTOR; pipeSpawnInterval=Math.max(MIN_PIPE_SPAWN_INTERVAL,Math.round(pipeSpawnInterval/DIFFICULTY_INCREASE_FACTOR)); console.log(`Difficulty++ S:${score} Spd:${pipeSpeed.toFixed(3)} Int:${pipeSpawnInterval}`); playSound(audioSuccess); } }

function drawPipes() {
    // Spawn logic
    if (frameCount === FIRST_PIPE_SPAWN_FRAME || (frameCount > FIRST_PIPE_SPAWN_FRAME && (frameCount - FIRST_PIPE_SPAWN_FRAME) % pipeSpawnInterval === 0)) {
        const minH = 50; const maxH = canvas.height - pipeGap - minH;
        let tH = Math.max(minH, Math.random() * maxH);

        // *** Generate stone data ONLY if the style will be stone (optimization) ***
        let generatedStoneData = null;
        // Check what the style *would* be for the *next* score
        let potentialNextScore = score + 1; // Or just check current score if spawning logic matches scoring closely
        if (potentialNextScore >= 10 && potentialNextScore < 20) {
            generatedStoneData = [];
            const baseColors = ['#A9A9A9', '#808080', '#696969', '#BEBEBE'];
            const pipeW = dimensions.width * PIPE_WIDTH_RATIO; // Need width for density calc
            const pipeArea = pipeW * dimensions.height; // Approximate area for density
            const stoneCount = Math.max(8, Math.floor(pipeArea / 2000)); // Adjust density calculation
            const scaleW = dimensions.width / 480;
            const scaleH = dimensions.height / 640;

            for (let i = 0; i < stoneCount; i++) {
                generatedStoneData.push({
                    xOffset: Math.random() * pipeW, // Relative X within pipe width
                    yOffset: Math.random() * dimensions.height, // Relative Y (will be clipped by top/bottom pipe height later)
                    width: (15 + Math.random() * 25) * scaleW,
                    height: (10 + Math.random() * 20) * scaleH,
                    rotation: Math.random() * Math.PI * 2,
                    colorIndex: Math.floor(Math.random() * baseColors.length)
                });
            }
        }

        pipes.push({
            x: canvas.width,
            topHeight: tH,
            scored: false,
            stoneData: generatedStoneData // Store the generated data (null if not stone)
        });
    }

    const pW = dimensions.width * PIPE_WIDTH_RATIO;
    const currentStyle = getPipeStyle(); // Get style based on CURRENT score for drawing

    for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i]; p.x -= pipeSpeed;
        const bY = p.topHeight + pipeGap; const bH = canvas.height - bY;
        let dF;
        // Select drawing function based on CURRENT style
        switch(currentStyle){
            case 'stone': dF = (x, y, w, h) => drawStonePattern(x, y, w, h, p.stoneData); break; // Pass stoneData
            case 'bamboo': dF = drawBambooPattern; break;
            case 'wood': dF = drawWoodPattern; break;
            default: dF = drawBrickPattern; break;
        }

        // Draw pipes using the selected function
        dF(p.x, 0, pW, p.topHeight);    // Draw top
        dF(p.x, bY, pW, bH);            // Draw bottom (Note: stone yOffsets are relative to top-left, need care for bottom)
        // Simpler: For bottom pipe, just call drawStonePattern with the bottom pipe's Y coord
        // The yOffsets inside drawStonePattern need to be interpreted relative to the 'y' passed in.
        // Let's adjust drawStonePattern slightly for clarity

        if(bird.x<p.x+pW&&bird.x+bird.width>p.x&&(bird.y<p.topHeight||bird.y+bird.height>bY)){triggerGameOver();return;}
        if(!p.scored&&p.x+pW<bird.x){
            score++; p.scored=true; playSound(audioScore);
            createParticles(5, p.x + pW, p.topHeight + pipeGap / 2, 'score'); // Score particles near gap center
            adjustDifficulty();
        }
        if(p.x+pW<0)pipes.splice(i,1);
    }
}
// Need to adjust drawStonePattern call for bottom pipe or adjust the function itself.
// Let's adjust the call:
// Replace the `dF(p.x, bY, pW, bH);` line in drawPipes loop with:
// if (currentStyle === 'stone') {
//    drawStonePattern(p.x, bY, pW, bH, p.stoneData); // Call specifically for bottom
// } else {
//    dF(p.x, bY, pW, bH); // Use the selected function for other types
//}
// This looks redundant. Let's modify drawStonePattern instead to handle y offsets correctly relative to the passed 'y'.
// The current drawStonePattern `ctx.ellipse(x + stone.xOffset, y + stone.yOffset, ...)` *already* does this.
// The issue might be that yOffset can be > bH. Let's filter stones when drawing.

// --- REVISED drawStonePattern to filter visible stones ---
function drawStonePattern(x, y, width, height, stoneData) {
    const baseColors = ['#A9A9A9', '#808080', '#696969', '#BEBEBE'];
    ctx.fillStyle = baseColors[1];
    ctx.fillRect(x, y, width, height);

    if (!stoneData) return;

    for (let i = 0; i < stoneData.length; i++) {
        const stone = stoneData[i];
        // Check if the stone's relative Y offset falls within the current pipe section's height
        if (stone.yOffset >= 0 && stone.yOffset <= dimensions.height) { // Check against total canvas height initially
             // Calculate absolute Y position of the stone center
             const absoluteStoneY = y + (stone.yOffset % height); // Modulo to wrap around? No, just check bounds.
             const stoneCenterRelY = stone.yOffset;

             // We need to know if this call is for the top or bottom pipe.
             // Hacky: check if y > canvas.height / 2 to guess it's the bottom pipe.
             // Better: Generate separate stone data for top and bottom section? More complex.
             // Simpler: Only draw if stone's Y offset is within the *bounds* of the current section *being drawn*
             if (stoneCenterRelY >= 0 && stoneCenterRelY <= height) { // Check if stone *center* is within the height of the segment being drawn

                ctx.fillStyle = baseColors[stone.colorIndex];
                ctx.beginPath();
                // Draw relative to the current segment's top-left (x, y)
                ctx.ellipse(x + stone.xOffset, y + stoneCenterRelY, stone.width / 2, stone.height / 2, stone.rotation, 0, 2 * Math.PI);
                ctx.fill();
             }
        }
         // Let's simplify stone generation - generate within bounds 0 to height only
    }
    ctx.strokeStyle = '#404040'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);
}
// --- REVISED Pipe Generation with bounded stone Y ---
// Inside drawPipes, when generatingStoneData:
// Replace `yOffset: Math.random() * dimensions.height` with:
// `yOffset: Math.random() * tH` for top pipe section
// And generate another set for bottom pipe section `yOffset: Math.random() * bH` ?
// Let's stick to one set but draw smarter in drawStonePattern.

// --- FINAL REVISION drawStonePattern (simpler) ---
function drawStonePattern(x, y, width, height, stoneData) {
    const baseColors = ['#A9A9A9', '#808080', '#696969', '#BEBEBE'];
    ctx.fillStyle = baseColors[1]; // Base color
    ctx.fillRect(x, y, width, height);

    if (!stoneData) return;

    for (let i = 0; i < stoneData.length; i++) {
        const stone = stoneData[i];
         // Draw the stone using its stored relative offsets from the segment's origin (x, y)
        ctx.fillStyle = baseColors[stone.colorIndex];
        ctx.beginPath();
        // The yOffset was generated relative to a full height pipe originally.
        // We need to only draw stones whose original FULL HEIGHT yOffset falls within this segment.
        // This requires knowing if we are drawing top or bottom pipe.

        // Let's RETRY the generation logic. Generate stones specifically for the top height.
        // And when drawing bottom, maybe reuse/mirror/generate new?
        // Easiest: Generate ONCE, draw TWICE relative to segment origins.
        ctx.ellipse(x + stone.xOffset, y + stone.yOffset, stone.width / 2, stone.height / 2, stone.rotation, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.strokeStyle = '#404040'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);
}
// --- FINAL REVISION Pipe Generation ---
// Inside drawPipes:
// let generatedStoneData = null;
// if (potentialNextScore >= 10 && potentialNextScore < 20) {
//     generatedStoneData = [];
//     const baseColors = [...]; const pipeW = ...; const stoneCount = ...; const scaleW=...; const scaleH=...;
//     for (let i = 0; i < stoneCount; i++) {
//         generatedStoneData.push({
//             xOffset: Math.random() * pipeW,
//             yOffset: Math.random() * dimensions.height, // Generate across FULL potential height
//             width: ..., height: ..., rotation: ..., colorIndex: ...
//         });
//     }
// }
// Now, drawStonePattern will draw the stone if its center `y + stone.yOffset` is visible.
// Let's re-run drawStonePattern:
function drawStonePattern(x, y, width, height, stoneData) {
    const baseColors = ['#A9A9A9', '#808080', '#696969', '#BEBEBE'];
    ctx.fillStyle = baseColors[1]; // Base color
    ctx.fillRect(x, y, width, height);

    if (!stoneData) return;

    for (let i = 0; i < stoneData.length; i++) {
        const stone = stoneData[i];
        // Calculate the absolute Y center of the stone if the pipe were full height
        const absoluteYCenter = stone.yOffset; // yOffset is 0 to canvas.height

        // Check if this absolute Y falls within the current segment's bounds [y, y + height]
        if (absoluteYCenter >= y && absoluteYCenter < y + height) {
            // Calculate the stone's Y position *relative* to the current segment's top 'y'
            const relativeY = absoluteYCenter - y;

            ctx.fillStyle = baseColors[stone.colorIndex];
            ctx.beginPath();
            // Draw relative to the current segment's origin (x, y) using the relative Y
            ctx.ellipse(x + stone.xOffset, y + relativeY, stone.width / 2, stone.height / 2, stone.rotation, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    ctx.strokeStyle = '#404040'; ctx.lineWidth = 2; ctx.strokeRect(x, y, width, height);
}
// This seems correct. Generate full height offsets once, drawStonePattern filters based on the segment (y, height) it's given.


function drawScore(){ctx.fillStyle="#FFF";ctx.font=`bold ${Math.max(24,dimensions.height*0.05)}px Arial`;ctx.textAlign="left";ctx.textBaseline="top";ctx.shadowColor="rgba(0,0,0,0.5)";ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;ctx.shadowBlur=3;ctx.fillText("Skor: "+score,10,10);ctx.shadowColor="transparent";ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.shadowBlur=0;}

function triggerGameOver(){
    if(gameOver)return; gameOver=true;
    playSound(audioGameOver);
    if (navigator.vibrate) { // Check for vibration support
        navigator.vibrate(150); // Vibrate for 150ms on hit
    }
    createParticles(30, bird.x + bird.width / 2, bird.y + bird.height / 2, 'hit'); // More hit particles
    cancelAnimationFrame(animationId); scoreDisplay.textContent=score; gameOverOverlay.style.display="flex"; jumpButton.style.display='none';
}

function update(){
    if(gameOver)return; ctx.clearRect(0,0,canvas.width,canvas.height);
    // Update bird BEFORE particles
    bird.velocity+=bird.gravity; bird.y+=bird.velocity;
    if(bird.y+bird.height>canvas.height){bird.y=canvas.height-bird.height;bird.velocity=0;triggerGameOver();return;}
    if(bird.y<0){bird.y=0;bird.velocity=0;}

    // Update & Draw Particles (Draw BEFORE bird/pipes so they appear behind? Or AFTER so they are on top?) Let's try AFTER.
    // Update particles regardless of game over? No, only when running.
    updateParticles();

    // Draw Game elements
    drawPipes(); if(gameOver)return;
    drawBird();
    drawParticles(); // Draw particles ON TOP of bird/pipes
    drawScore();
    frameCount++; animationId=requestAnimationFrame(update);
}

function resetGame(){
    canvas.style.display='none'; instructionsOverlay.style.display='flex'; gameOverOverlay.style.display='none'; jumpButton.style.display='none';
    bird.y=dimensions.height/4; bird.velocity=0; bird.gravity=BASE_GRAVITY; bird.lift=BASE_LIFT;
    pipes=[]; score=0; gameOver=false; gameStarted=false; frameCount=0;
    pipeSpeed=BASE_PIPE_SPEED; pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL;
    isStartPlaying=false; jumpQueue=false;
    particles = []; // Clear particles on reset
    cancelAnimationFrame(animationId); console.log("Game Reset (A.5)");
}

function startGame(){
    if(gameStarted)return;
    // Calculate dimensions FIRST
    updateDimensions();

    instructionsOverlay.style.display='none'; canvas.style.display='block'; jumpButton.style.display='block';
    bird.gravity=BASE_GRAVITY; bird.lift=BASE_LIFT; pipeSpeed=BASE_PIPE_SPEED; pipeSpawnInterval=BASE_PIPE_SPAWN_INTERVAL;
    frameCount=0; bird.y=dimensions.height/4; bird.velocity=0; // Reset position based on dimensions
    pipes = []; // Clear pipes from previous game if any
    particles = []; // Clear any leftover particles
    score = 0; // Reset score

    if(!audioInitialized){playSound(audioStart);audioInitialized=true;}else{playSound(audioStart);}
    gameStarted=true; gameOver=false; console.log("Game Starting (A.5)");
    update();
}

// Initial Setup & Event Listeners
startButton.addEventListener('click',startGame);
restartButton.addEventListener('click',resetGame);

// Remove updateDimensions from load, rely on CSS and startGame call
window.addEventListener('load',()=>{
    console.log("Window loaded. Initial state set by CSS.");
    // Ensure initial visibility is correct based on CSS defaults
    instructionsOverlay.style.display = 'flex';
    canvas.style.display = 'none';
    jumpButton.style.display = 'none';
    // Don't calculate dimensions or set bird position here.
});

const resizeObserver=new ResizeObserver(e=>{if(e[0]){console.log("Resize detected, updating dimensions.");updateDimensions();if(!gameStarted||gameOver){bird.y=dimensions.height/4;}if(!gameStarted&&!gameOver){}else if(gameOver){}}});
resizeObserver.observe(document.body);window.addEventListener('resize',updateDimensions);
window.addEventListener('keydown',function(e){if(e.code==='Space'&&e.target==document.body)e.preventDefault();});