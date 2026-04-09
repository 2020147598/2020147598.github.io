import { resizeAspectRatio, Axes } from './util.js';
import { Shader, readShaderFile } from './shader.js';
import { SquarePyramid } from './squarePyramid.js'; // 사각뿔 클래스 임포트

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let startTime;

let isInitialized = false;

let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create(); 

// 카메라 제어용 상수
const cameraCircleRadius = 3.0;
const cameraXZSpeed = 90.0; // x, z 방향 속도: 90 deg/sec
const cameraYSpeed = 45.0;  // y 방향 속도: 45 deg/sec

let pyramid;
let axes;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('program terminated');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('program terminated with error:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // 영상과 비슷한 남색 톤으로 배경색 설정
    gl.clearColor(0.15, 0.2, 0.3, 1.0);
    
    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function render() {
    const currentTime = Date.now();

    // 시작 시간으로부터 경과된 시간 (초 단위)
    const elapsedTime = (currentTime - startTime) / 1000.0; 

    // 화면 지우기
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // 요구사항 6: 사각뿔은 제자리에 고정되어 있으며 회전하지 않음
    mat4.identity(modelMatrix);

    // 요구사항 4 & 5: 카메라의 움직임 적용
    // x와 z는 90 deg/sec 의 속도로 반지름 3인 원운동
    const xzAngle = glMatrix.toRadian(cameraXZSpeed * elapsedTime);
    let camX = cameraCircleRadius * Math.sin(xzAngle);
    let camZ = cameraCircleRadius * Math.cos(xzAngle);
    
    // y는 45 deg/sec 의 속도로 0부터 10까지 계속 반복 (Math.sin() 이용)
    // -1 ~ 1 범위를 가지는 sin 값을 변형하여 0 ~ 10을 오가도록 수식 작성 (시작 시 y=0)
    const yAngle = glMatrix.toRadian(cameraYSpeed * elapsedTime - 90.0);
    let camY = 5.0 + 5.0 * Math.sin(yAngle); 

    mat4.lookAt(viewMatrix, 
        vec3.fromValues(camX, camY, camZ), // camera position
        vec3.fromValues(0, 0, 0),          // look at origin (사각뿔 밑면 중심)
        vec3.fromValues(0, 1, 0));         // up vector

    // 사각뿔 그리기
    shader.use();  
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setMat4('u_projection', projMatrix);
    pyramid.draw(shader);

    // 축 그리기
    axes.draw(viewMatrix, projMatrix);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }
        
        await initShader();

        // 큐브 대신 사각뿔(Square Pyramid) 초기화
        pyramid = new SquarePyramid(gl);
        axes = new Axes(gl, 1.8);

        // Projection transformation matrix
        mat4.perspective(
            projMatrix,
            glMatrix.toRadian(60),  // field of view (fov, degree)
            canvas.width / canvas.height, // aspect ratio
            0.1, // near
            100.0 // far
        );

        // 애니메이션 시작 시간 기록
        startTime = Date.now();

        // 첫 렌더 루프 실행
        requestAnimationFrame(render);

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}