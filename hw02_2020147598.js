import { readShaderFile, Shader } from './shader.js'; 
import { resizeAspectRatio, setupText } from './util.js';

async function init() {
    const canvas = document.getElementById('glCanvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert("WebGL 2.0을 지원하지 않는 브라우저입니다.");
        return;
    }

    // 8) resizeAspectRatio를 이용해 가로세로 비율 1:1 유지
    resizeAspectRatio(gl, canvas);

    // 7) setupText를 이용해 캔버스 위에 안내 메시지 표시
    setupText(canvas, "Use arrow keys to move the rectangle", 1);

    // 6) 독립된 파일에서 셰이더 읽어오기
    const vsSource = await readShaderFile('vertex.glsl');
    const fsSource = await readShaderFile('fragment.glsl');

    // shader.js의 Shader 클래스를 이용해 셰이더 초기화
    const shader = new Shader(gl, vsSource, fsSource);

    // 2) 한 변의 길이가 0.2인 정사각형 
    // 5) primitive는 TRIANGLE_FAN 사용 
    const halfSize = 0.1; 
    const vertices = new Float32Array([
        -halfSize,  halfSize, // 좌상단
        -halfSize, -halfSize, // 좌하단
         halfSize, -halfSize, // 우하단
         halfSize,  halfSize  // 우상단
    ]);

    // 버텍스 버퍼 생성 및 데이터 전달
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Shader 프로그램 사용
    shader.use();

    // attribute 활성화
    const a_positionLoc = gl.getAttribLocation(shader.program, 'a_position');
    gl.enableVertexAttribArray(a_positionLoc);
    gl.vertexAttribPointer(a_positionLoc, 2, gl.FLOAT, false, 0, 0);

    let tx = 0.0;
    let ty = 0.0;
    const step = 0.01;
    // 캔버스 이탈 방지 한계값 (전체 공간 1.0 - 사각형 절반 0.1 = 0.9)
    const limit = 0.9; 

    // 키보드 이벤트 리스너
    window.addEventListener('keydown', (event) => {
        // 3) 화살표 키를 누를 때 +0.01 또는 -0.01 이동 및 범위 제한
        if (event.key === 'ArrowUp') {
            ty = Math.min(ty + step, limit);
        } else if (event.key === 'ArrowDown') {
            ty = Math.max(ty - step, -limit);
        } else if (event.key === 'ArrowLeft') {
            tx = Math.max(tx - step, -limit);
        } else if (event.key === 'ArrowRight') {
            tx = Math.min(tx + step, limit);
        }
        
        draw(); // 값이 변경될 때마다 화면 갱신
    });

    // 그리기 함수
    function draw() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 4) uniform 변수를 이용하여 이동 좌표 수정
        // Shader 클래스의 setVec2 메서드 활용
        shader.setVec2('u_translation', tx, ty);

        // 5) index 없이 TRIANGLE_FAN으로 그리기
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    // 초기 화면 그리기
    draw();
}

// 프로그램 실행
init();