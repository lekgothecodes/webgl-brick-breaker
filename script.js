// Canvas and WebGL setup
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  alert("WebGL is not supported in your browser.");
}

// HTML Elements
const startOverlay = document.getElementById('startOverlay');
const playerNameInput = document.getElementById('playerName');

// Vertex Shader
const vsSource = `
attribute vec2 a_position;
uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`;

// Fragment Shader
const fsSource = `
precision mediump float;
uniform vec4 u_color;

void main() {
    gl_FragColor = u_color;
}
`;

// Load shader
function loadShader(type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('Shader compile failed: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// Initialize shader program
function initShaderProgram(vsSource, fsSource) {
  const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);

  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Shader program failed: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

const shaderProgram = initShaderProgram(vsSource, fsSource);

// Program info
const programInfo = {
  program: shaderProgram,

  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, 'a_position'),
  },

  uniformLocations: {
    matrix: gl.getUniformLocation(shaderProgram, 'u_matrix'),
    color: gl.getUniformLocation(shaderProgram, 'u_color'),
  },
};

// Rectangle positions
const positions = [
  0, 0,
  1, 0,
  0, 1,

  0, 1,
  1, 0,
  1, 1,
];

// Buffer setup
const positionBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array(positions),
  gl.STATIC_DRAW
);

// Bricks
const brickRows = 10;
const brickCols = 15;

const bricks = [];

const brickWidth = 0.12;
const brickHeight = 0.07;

// Brick colors
function getColor(row) {
  const colors = [
    [1, 0.8, 0],
    [0.5, 1, 0],
    [0, 1, 0.5],
    [0, 1, 1],
    [0, 0.5, 1],
    [0.5, 0, 1],
    [1, 0, 1],
    [1, 0, 0.5],
    [1, 0.5, 0],
    [0, 1, 0.8],
  ];

  return colors[row % colors.length];
}

// Create bricks
for (let r = 0; r < brickRows; r++) {
  for (let c = 0; c < brickCols; c++) {
    bricks.push({
      x: -1 + c * (brickWidth + 0.01),
      y: 1 - r * (brickHeight + 0.01) - 0.1,
      destroyed: false,
      color: getColor(r),
    });
  }
}

// Ball
let ball = {
  x: 0,
  y: -0.5,
  dx: 0.006,
  dy: 0.009,
  size: 0.025,
};

// Paddle
let paddle = {
  x: -0.2,
  y: -0.9,
  width: 0.4,
  height: 0.05,
  speed: 0.03,
};

// Game state
let keys = {};
let gameOver = false;
let win = false;
let paused = false;
let started = false;
let score = 0;

// Keyboard controls
document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Matrix functions
function identity() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function translate(m, tx, ty) {
  m[12] += tx;
  m[13] += ty;

  return m;
}

function scale(m, sx, sy) {
  m[0] *= sx;
  m[5] *= sy;

  return m;
}

// Draw rectangle
function drawRect(x, y, w, h, color) {

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );

  gl.enableVertexAttribArray(
    programInfo.attribLocations.vertexPosition
  );

  let matrix = identity();

  matrix = translate(matrix, x, y);
  matrix = scale(matrix, w, h);

  gl.uniformMatrix4fv(
    programInfo.uniformLocations.matrix,
    false,
    matrix
  );

  gl.uniform4fv(
    programInfo.uniformLocations.color,
    color
  );

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// Render loop
function render() {

  if (!started || paused) {
    requestAnimationFrame(render);
    return;
  }

  gl.clearColor(0, 0, 0, 1);

  gl.clear(gl.COLOR_BUFFER_BIT);

  // Game over
  if (gameOver) {
    drawEndScreen();
    return;
  }

  // Paddle movement
  if (keys['ArrowLeft'] && paddle.x > -1) {
    paddle.x -= paddle.speed;
  }

  if (keys['ArrowRight'] && paddle.x + paddle.width < 1) {
    paddle.x += paddle.speed;
  }

  // Ball movement
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Wall collision
  if (ball.x < -1 || ball.x > 1) {
    ball.dx *= -1;
  }

  if (ball.y > 1) {
    ball.dy *= -1;
  }

  // Bottom collision
  if (ball.y < -1) {
    gameOver = true;
    win = false;
  }

  // Paddle collision
  if (
    ball.x > paddle.x &&
    ball.x < paddle.x + paddle.width &&
    ball.y - ball.size < paddle.y + paddle.height &&
    ball.y > paddle.y
  ) {
    ball.dy *= -1;
  }

  // Brick collision
  for (let b of bricks) {

    if (
      !b.destroyed &&
      ball.x > b.x &&
      ball.x < b.x + brickWidth &&
      ball.y + ball.size > b.y &&
      ball.y - ball.size < b.y + brickHeight
    ) {

      ball.dy *= -1;

      b.destroyed = true;

      score += 10;

      document.getElementById("score").innerText = score;

      break;
    }
  }

  // Draw bricks
  for (let b of bricks) {

    if (!b.destroyed) {

      drawRect(
        b.x,
        b.y,
        brickWidth,
        brickHeight,
        [...b.color, 1]
      );
    }
  }

  // Draw paddle
  drawRect(
    paddle.x,
    paddle.y,
    paddle.width,
    paddle.height,
    [1, 1, 1, 1]
  );

  // Draw ball
  drawRect(
    ball.x - ball.size / 2,
    ball.y - ball.size / 2,
    ball.size,
    ball.size,
    [1, 1, 1, 1]
  );

  // Win check
  if (bricks.every(b => b.destroyed)) {
    gameOver = true;
    win = true;
  }

  requestAnimationFrame(render);
}

// End screen
function drawEndScreen() {

  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.clearColor(0, 0, 0, 1);

  drawRect(-1, -1, 2, 2, [0, 0, 0, 1]);

  const message = document.getElementById('message');

  message.style.display = 'block';

  message.innerText = win
    ? "🎉 You Win!"
    : "💀 You Lost!";
}

// Start game
function startGame() {

  const playerName = playerNameInput.value.trim();

  if (playerName === "") {
    alert("Please enter your name to start the game.");
    return;
  }

  started = true;
  paused = false;
  gameOver = false;

  startOverlay.style.display = "none";

  document.getElementById("message").style.display = "none";

  document.getElementById("playerDisplay").innerText =
    "Player: " + playerName;

  requestAnimationFrame(render);
}

// Pause / Resume
function pauseResumeGame() {

  if (started && !gameOver) {
    paused = !paused;
  }
}

// Restart
function restartGame() {
  location.reload();
}

// Button controls
function movePaddleLeft() {

  if (paddle.x > -1) {
    paddle.x -= paddle.speed;
  }
}

function movePaddleRight() {

  if (paddle.x + paddle.width < 1) {
    paddle.x += paddle.speed;
  }
}

// Use shader program
gl.useProgram(programInfo.program);

// Start render loop
render();