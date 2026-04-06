import { resizeAspectRatio } from './util.js';
import { Shader, readShaderFile } from './shader.js';

const mat4 = window.mat4;

let isInitialized = false;
const canvas = document.getElementById('glCanvas');
let gl;
let shader;
let vao;
let startTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        startTime = performance.now();
        requestAnimationFrame(animate);
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    gl = canvas.getContext('webgl2');
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // 영상과 비슷한 어두운 파란색으로 배경색 설정
    gl.clearColor(0.1, 0.2, 0.3, 1.0); 
    
    return true;
}

function setupBuffers() {
    // 중심점 기준 단위 사각형 버텍스 데이터 (-0.5 ~ 0.5)
    const vertices = new Float32Array([
        -0.5,  0.5,  // 좌상단
        -0.5, -0.5,  // 좌하단
         0.5,  0.5,  // 우상단
         0.5, -0.5   // 우하단
    ]);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // VBO for position
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    // shader.js의 setAttribPointer 대신 직접 활성화
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('vertex.glsl');
    const fragmentShaderSource = await readShaderFile('fragment.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

// 사각형 하나를 그리는 함수 (행렬과 색상을 받아 그림)
function drawRect(transformMatrix, colorArray) {
    shader.setMat4("u_transform", transformMatrix);
    shader.setVec4("u_color", colorArray[0], colorArray[1], colorArray[2], colorArray[3]);
    
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function render(currentTime) {
    gl.clear(gl.COLOR_BUFFER_BIT);
    shader.use();

    // 경과 시간 계산 (초 단위)
    const elapsedTime = (currentTime - startTime) / 1000.0;

    // 과제 조건: 바람의 세기에 따라 sin 함수를 이용해 주기적으로 변화
    // 큰 날개와 작은 날개의 회전 각도 계산 
    const largeAngle = Math.sin(elapsedTime) * Math.PI * 2.0;
    const smallAngle = Math.sin(elapsedTime) * Math.PI * -10.0;

    // 1. 기둥 그리기 (고정)
    let pillarMat = mat4.create();
    mat4.translate(pillarMat, pillarMat, [0.0, -0.2, 0.0]); // 화면 중앙보다 약간 아래 배치
    mat4.scale(pillarMat, pillarMat, [0.12, 0.8, 1.0]);     // 기둥의 적절한 비율 설정
    drawRect(pillarMat, [0.55, 0.35, 0.15, 1.0]); // 갈색

    // --- 계층적 변환(Hierarchical Transformation) ---
    // 큰 날개의 중심점 (기둥의 윗부분)
    let centerMat = mat4.create();
    mat4.translate(centerMat, centerMat, [0.0, 0.2, 0.0]);
    mat4.rotateZ(centerMat, centerMat, largeAngle); // 큰 날개의 회전 적용

    // 2. 큰 날개 (과제의 '4개의 직사각형' 조건을 맞추기 위해 중앙 기준 좌/우 2개로 분리) 
    // 2-1. 큰 날개 (왼쪽 부분)
    let largeLeftMat = mat4.clone(centerMat);
    mat4.translate(largeLeftMat, largeLeftMat, [-0.2, 0.0, 0.0]); // 중심에서 왼쪽으로
    mat4.scale(largeLeftMat, largeLeftMat, [0.4, 0.08, 1.0]);
    drawRect(largeLeftMat, [0.95, 0.95, 0.95, 1.0]); // 흰색

    // 2-2. 큰 날개 (오른쪽 부분)
    let largeRightMat = mat4.clone(centerMat);
    mat4.translate(largeRightMat, largeRightMat, [0.2, 0.0, 0.0]); // 중심에서 오른쪽으로
    mat4.scale(largeRightMat, largeRightMat, [0.4, 0.08, 1.0]);
    drawRect(largeRightMat, [0.95, 0.95, 0.95, 1.0]); // 흰색

    // 3. 작은 날개 1 (큰 날개의 왼쪽 끝에 부착)
    let smallBlade1Mat = mat4.clone(centerMat); // 큰 날개의 위치와 회전을 상속받음
    mat4.translate(smallBlade1Mat, smallBlade1Mat, [-0.4, 0.0, 0.0]); // 왼쪽 끝 지점으로 이동
    mat4.rotateZ(smallBlade1Mat, smallBlade1Mat, smallAngle); // 자기 자신을 중심으로 추가 회전
    mat4.scale(smallBlade1Mat, smallBlade1Mat, [0.15, 0.04, 1.0]);
    drawRect(smallBlade1Mat, [0.7, 0.7, 0.7, 1.0]); // 회색

    // 4. 작은 날개 2 (큰 날개의 오른쪽 끝에 부착)
    let smallBlade2Mat = mat4.clone(centerMat); // 큰 날개의 위치와 회전을 상속받음
    mat4.translate(smallBlade2Mat, smallBlade2Mat, [0.4, 0.0, 0.0]); // 오른쪽 끝 지점으로 이동
    mat4.rotateZ(smallBlade2Mat, smallBlade2Mat, smallAngle); // 자기 자신을 중심으로 추가 회전
    mat4.scale(smallBlade2Mat, smallBlade2Mat, [0.15, 0.04, 1.0]);
    drawRect(smallBlade2Mat, [0.7, 0.7, 0.7, 1.0]); // 회색
}

function animate(currentTime) {
    render(currentTime);
    requestAnimationFrame(animate);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }

        await initShader();
        setupBuffers();

        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}