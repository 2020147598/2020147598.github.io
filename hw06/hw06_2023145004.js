
import { setupText, updateText, Axes } from './util.js';
import { Shader, readShaderFile } from './shader.js';
import { Cube } from './cube.js';

let canvas = null;
let gl = null;

let shader;
let lastFrameTime = 0;
let isInitialized = false;


let hudLine1 = null;
let hudLine2 = null;
let hudLine3 = null;


const viewMatrixLeft = mat4.create();
const projMatrixLeft = mat4.create();
const viewMatrixRight = mat4.create();
const projMatrixRight = mat4.create();


let cube = null;
let axes = null;
const cubeModelMatrices = [];

let cameraPos = vec3.fromValues(0, 0, 5);
let cameraFront = vec3.fromValues(0, 0, -1);
const cameraUp = vec3.fromValues(0, 1, 0);
let yaw = -90;
let pitch = 0;
const mouseSensitivity = 0.1;
const cameraSpeed = 2.5;


const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false
};

function resetKeys() {
  keys.KeyW = false;
  keys.KeyA = false;
  keys.KeyS = false;
  keys.KeyD = false;
}

function onKeyDown(e) {
  if (e.code in keys) {
    keys[e.code] = true;
    e.preventDefault();
  }
}

function onKeyUp(e) {
  if (e.code in keys) {
    keys[e.code] = false;
    e.preventDefault();
  }
}

function onPointerLockChange() {
  if (document.pointerLockElement === canvas) {
    document.addEventListener('mousemove', updateCamera);
  } else {
    document.removeEventListener('mousemove', updateCamera);
    resetKeys();
  }
}

function updateCamera(e) {
  const xoffset = e.movementX * mouseSensitivity;
  const yoffset = -e.movementY * mouseSensitivity;

  yaw += xoffset;
  pitch += yoffset;

  if (pitch > 89.0) pitch = 89.0;
  if (pitch < -89.0) pitch = -89.0;

  const direction = vec3.create();
  direction[0] = Math.cos(glMatrix.toRadian(yaw)) * Math.cos(glMatrix.toRadian(pitch));
  direction[1] = Math.sin(glMatrix.toRadian(pitch));
  direction[2] = Math.sin(glMatrix.toRadian(yaw)) * Math.cos(glMatrix.toRadian(pitch));
  vec3.normalize(cameraFront, direction);
}

function initCubeModelMatrices() {
  // (2,0,0.5,-3.0)은 4개 값이므로 (2.0, 0.5, -3.0)으로 해석
  const positions = [
    [0.0, 0.0, 0.0],
    [2.0, 0.5, -3.0],
    [-1.5, -0.5, -2.5],
    [3.0, 0.0, -4.0],
    [-3.0, 0.0, 1.0]
  ];

  cubeModelMatrices.length = 0;
  for (const p of positions) {
    const m = mat4.create();
    mat4.translate(m, m, p);
    cubeModelMatrices.push(m);
  }
}

function initWebGL() {
  if (!gl) {
    console.error('WebGL2 is not supported.');
    return false;
  }

  canvas.width = 1400;
  canvas.height = 700;
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.SCISSOR_TEST);

  return true;
}

async function initShader() {
  const vertexShaderSource = await readShaderFile('shVert.glsl');
  const fragmentShaderSource = await readShaderFile('shFrag.glsl');
  shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function updateLeftCamera(deltaTime) {
  const speed = cameraSpeed * deltaTime;

  if (keys.KeyW) vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, speed);
  if (keys.KeyS) vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, -speed);

  const cameraRight = vec3.create();
  vec3.cross(cameraRight, cameraFront, cameraUp);
  vec3.normalize(cameraRight, cameraRight);

  if (keys.KeyA) vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, -speed);
  if (keys.KeyD) vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, speed);

  mat4.lookAt(
    viewMatrixLeft,
    cameraPos,
    vec3.add(vec3.create(), cameraPos, cameraFront),
    cameraUp
  );
}

function drawScene(viewMatrix, projMatrix) {
  shader.use();
  shader.setMat4('u_view', viewMatrix);
  shader.setMat4('u_projection', projMatrix);

  for (const modelMatrix of cubeModelMatrices) {
    shader.setMat4('u_model', modelMatrix);
    cube.draw(shader);
  }

  axes.draw(viewMatrix, projMatrix);
}

function updateHudText() {
  const x = cameraPos[0].toFixed(1);
  const y = cameraPos[1].toFixed(1);
  const z = cameraPos[2].toFixed(1);
  const yv = yaw.toFixed(1);
  const pv = pitch.toFixed(1);

  updateText(hudLine1, `Camera pos: (${x}, ${y}, ${z}) | Yaw: ${yv}° | Pitch: ${pv}°`);
  updateText(hudLine2, 'WASD: move | Mouse: rotate (click to lock) | ESC: unlock');
  updateText(hudLine3, 'Left: Perspective | Right: Orthographic (Top-Down)');
}

function render() {
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastFrameTime) / 1000.0;
  lastFrameTime = currentTime;

  updateLeftCamera(deltaTime);

  gl.enable(gl.SCISSOR_TEST);

  // Left viewport: 기존 색
  gl.viewport(0, 0, 700, 700);
  gl.scissor(0, 0, 700, 700);
  gl.clearColor(0.1, 0.2, 0.3, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene(viewMatrixLeft, projMatrixLeft);

  // Right viewport: 요청 색
  gl.viewport(700, 0, 700, 700);
  gl.scissor(700, 0, 700, 700);
  gl.clearColor(0.05, 0.15, 0.2, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene(viewMatrixRight, projMatrixRight);

  updateHudText();
  requestAnimationFrame(render);
}

async function main() {
  try {
    canvas = document.getElementById('glCanvas');
    if (!canvas) throw new Error('Canvas element #glCanvas not found');

    gl = canvas.getContext('webgl2');
    if (!initWebGL()) throw new Error('Failed to initialize WebGL');

    cube = new Cube(gl);
    axes = new Axes(gl, 2.0);

    // events
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('blur', resetKeys);
    canvas.addEventListener('click', () => canvas.requestPointerLock());

    await initShader();

    // Left: perspective
    mat4.perspective(projMatrixLeft, glMatrix.toRadian(60.0), 1.0, 0.1, 100.0);

    // Right: top-down orthographic
    mat4.lookAt(
      viewMatrixRight,
      vec3.fromValues(0, 15, 0),
      vec3.fromValues(0, 0, 0),
      vec3.fromValues(0, 0, -1)
    );
    mat4.ortho(projMatrixRight, -10.0, 10.0, -10.0, 10.0, 0.1, 100.0);

    initCubeModelMatrices();

    // HUD
    hudLine1 = setupText(canvas, 'Camera pos: (0.0, 0.0, 5.0) | Yaw: -90.0° | Pitch: 0.0°', 1);
    hudLine2 = setupText(canvas, 'WASD: move | Mouse: rotate (click to lock) | ESC: unlock', 2);
    hudLine3 = setupText(canvas, 'Left: Perspective | Right: Orthographic (Top-Down)', 3);

    lastFrameTime = performance.now();
    requestAnimationFrame(render);

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize program:', error);
    alert('Failed to initialize program');
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!isInitialized) main();
});
