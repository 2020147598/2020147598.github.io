import { resizeAspectRatio, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';
import { SquarePyramid } from './squarePyramid.js'; // 사각뿔 클래스 임포트
import { loadTexture } from '../util/texture.js';
import { Arcball } from '../util/arcball.js';


const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

let shader;
let isInitialized = false;

let viewMatrix = mat4.create();
let projMatrix = mat4.create();
let modelMatrix = mat4.create(); 

// 카메라 제어용 상수
const cameraCircleRadius = 3.0;
const cameraXZSpeed = 90.0; // x, z 방향 속도: 90 deg/sec
const cameraYSpeed = 45.0;  // y 방향 속도: 45 deg/sec

let axes;
let texture;
let pyramid;
let arcball;

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
    // 캔버스 초기화
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // Arcball로부터 실시간 View Matrix 가져오기
    viewMatrix = arcball.getViewMatrix();

    // 모델 위치 (과제 5와 동일하게 원점(0,0,0)에 고정)
    mat4.identity(modelMatrix);

    // 사각뿔 렌더링
    shader.use();
    shader.setMat4('u_model', modelMatrix);
    shader.setMat4('u_view', viewMatrix);
    shader.setMat4('u_projection', projMatrix);
    pyramid.draw(shader);

    // 축 렌더링
    axes.draw(viewMatrix, projMatrix);

    requestAnimationFrame(render);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }
        
        await initShader();

        // 1. 객체 초기화
        axes = new Axes(gl, 1.5);
        pyramid = new SquarePyramid(gl);
        // 2. 텍스처 로딩
        texture = loadTexture(gl, true, 'sunrise.jpg'); 
        // 3. 아크볼 초기화 (마우스 드래그로 회전 제어)
        arcball = new Arcball(canvas, 3.0, { rotation: 2.0, zoom: 0.0005 });
        // 4. 투영 행렬 설정 (Perspective Projection)
        mat4.perspective(
            projMatrix,
            glMatrix.toRadian(60),  
            canvas.width / canvas.height, 
            0.1, 
            100.0 
        );

        // 5. 텍스처 바인딩 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        shader.setInt('u_texture', 0);
        // 렌더링 루프 시작
        requestAnimationFrame(render);

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Failed to initialize program');
        return false;
    }
}