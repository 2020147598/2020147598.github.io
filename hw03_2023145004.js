import { resizeAspectRatio, setupText, updateText, Axes } from './util.js';
import { Shader, readShaderFile } from './shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  
let shader;
let vao;
let positionBuffer; 
let isDrawing = false; 
let startPoint = null;  
let tempEndPoint = null; 
let radius;
let lines = []; 
let textOverlay; 
let textOverlay2; 
let textOverlay3;
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)
let intersectionpoints = [];


document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
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
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  
        -((y / canvas.height) * 2 - 1) 
    ];
}


function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
        event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

        const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
        const x = event.clientX - rect.left;  // canvas 내 x 좌표
        const y = event.clientY - rect.top;   // canvas 내 y 좌표
        
        if (!isDrawing && lines.length < 2) { 
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            startPoint = [glX, glY];
            isDrawing = true; // 이제 mouse button을 놓을 때까지 계속 true로 둠. 즉, mouse down 상태가 됨
        }
    }

    function handleMouseMove(event) {
        if (isDrawing) { 
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            tempEndPoint = [glX, glY]; // 임시 선분의 끝 point
            render();
        }
    }

    function handleMouseUp() {
        if (isDrawing && tempEndPoint) {

            lines.push([...startPoint, ...tempEndPoint]); 

            if (lines.length == 1) {
                radius = Math.sqrt((lines[0][0]-lines[0][2]) ** 2+(lines[0][1]-lines[0][3]) ** 2);
                updateText(textOverlay, "Circle: center (" + lines[0][0].toFixed(2) + ", " + lines[0][1].toFixed(2) + 
                    ") radius = " + radius.toFixed(2));
                
            }
            else { 
                updateText(textOverlay2, "Line segment: (" + lines[1][0].toFixed(2) + ", " + lines[1][1].toFixed(2) + 
                    ") ~ (" + lines[1][2].toFixed(2) + ", " + lines[1][3].toFixed(2) + ")");
                    
                intersectionpoints = intersection([lines[0][0],lines[0][1]],radius,[lines[1][0],lines[1][1]],[lines[1][2],lines[1][3]]);
                if(intersectionpoints.length == 0 ){
                updateText(textOverlay3, "No intersection");
                 }
                if(intersectionpoints.length == 1 ){
                updateText(textOverlay3, "Intersection Points: 1 Point 1: ("+intersectionpoints[0][0].toFixed(2)+", "+intersectionpoints[0][1].toFixed(2)+")");
                }
                if(intersectionpoints.length ==  2){
                updateText(textOverlay3, "Intersection Points: 2 Point 1: ("+intersectionpoints[0][0].toFixed(2)+", "+intersectionpoints[0][1].toFixed(2)+") Point 2: ("
                    +intersectionpoints[1][0].toFixed(2) +", "+intersectionpoints[1][1].toFixed(2)+")"
                );
            }
            }
            

            
            


            isDrawing = false;
            startPoint = null;
            tempEndPoint = null;
            render();
        }
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function intersection(center, radius, start, end){
    const cx = center[0];
    const cy = center[1];
    const x0 = start[0];
    const y0 = start[1];
    const x1 = end[0];
    const y1 = end[1];

    const points = [];

    const a = (x1-x0)**2 + (y1-y0)**2;
    const b = 2*((x0-cx)*(x1-x0) + (y0-cy)*(y1-y0));
    const c = (x0-cx)**2 +(y0-cy)**2-radius**2;

    const d = b**2-4*a*c;

    if(d<0){
        return points;
    }
    if(Math.abs(d) < 1e-8){
        const t = -b/2/a;
        if(t >= 0 && t <= 1) {
            points.push([x0+t*(x1-x0),y0+t*(y1-y0)]);
        }
        return points;
    }

    const t1 = (-b - Math.sqrt(d))/2/a;
    const t2 = (-b + Math.sqrt(d))/2/a;

    if(t1 >= 0 && t1 <= 1){
        points.push([x0+t1*(x1-x0),y0+t1*(y1-y0)]);
    }
    if(t2 >= 0 && t2 <= 1){
        points.push([x0+t2*(x1-x0),y0+t2*(y1-y0)]);
    }

    return points;
}

function circlevertices(center, radius, segments = 100){
    
    const vertices = [];

    for(let i = 0; i< segments; i++){
        const theta = (i/segments)*2.0*Math.PI;
        const x = center[0] + radius * Math.cos(theta);
        const y = center[1] + radius * Math.sin(theta);
        vertices.push(x,y);
    }
    return new Float32Array(vertices);

}



function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.use();
    gl.bindVertexArray(vao);

    // 저장된 선들 그리기
    let num = 0;
    for (let line of lines) {
        if (num == 0) { // 첫 번째 선분인 경우, yellow
            radius = Math.sqrt((lines[0][0]-lines[0][2]) ** 2+(lines[0][1]-lines[0][3]) ** 2);
            shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]);
            
            const circleVertices = circlevertices([line[0], line[1]], radius);
            gl.bufferData(gl.ARRAY_BUFFER, circleVertices, gl.STATIC_DRAW);
            gl.drawArrays(gl.LINE_LOOP, 0, circleVertices.length / 2);
        }
        else { // num == 1 (2번째 선분인 경우), red
            shader.setVec4("u_color", [0.0, 0.5, 1.0, 1.0]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
        
            gl.drawArrays(gl.LINES, 0, 2);
        }
        
        num++;
    }

    // 임시 선 그리기
    if (isDrawing && startPoint && tempEndPoint) {
    shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]);

    if (lines.length === 0) {
        const tempRadius = Math.sqrt(
            (startPoint[0] - tempEndPoint[0]) ** 2 +
            (startPoint[1] - tempEndPoint[1]) ** 2
        );

        const circleVertices = circlevertices(startPoint, tempRadius);
        gl.bufferData(gl.ARRAY_BUFFER, circleVertices, gl.STATIC_DRAW);
        gl.drawArrays(gl.LINE_LOOP, 0, circleVertices.length / 2);
    } else if (lines.length === 1) {
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([...startPoint, ...tempEndPoint]),
            gl.STATIC_DRAW
        );
        gl.drawArrays(gl.LINES, 0, 2);
    }
}

    // axes 그리기
    

    if(intersectionpoints.length > 0){
        shader.setVec4("u_color", [1,1,0,1]);

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(intersectionpoints.flat()),gl.STATIC_DRAW);

        gl.drawArrays(gl.POINTS, 0, intersectionpoints.length);
    }
    axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달
    
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더 초기화
        await initShader();
        
        // 나머지 초기화
        setupBuffers();
        shader.use();

        // 텍스트 초기화
        textOverlay = setupText(canvas, "", 1);
        textOverlay2 = setupText(canvas, "", 2);
        textOverlay3 = setupText(canvas, "",3);
        // 마우스 이벤트 설정
        setupMouseEvents();
        
        // 초기 렌더링
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
