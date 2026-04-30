/*-----------------------------------------------------------------------------
class SquarePyramid
과제 요구사항에 맞춘 사각뿔(Squared Pyramid) 모델 클래스입니다.
- 밑면(bottom face)의 크기는 dx = dz = 1 
- 중심은 (0,0)이며 xz 평면(y=0) 위에 위치
- 높이(height)는 1 (꼭지점 좌표: 0, 1, 0)
- 면의 색상: Front(Red), Right(Yellow), Back(Magenta), Left(Cyan), Bottom(Blue)
-----------------------------------------------------------------------------*/

export class SquarePyramid {
    constructor(gl, options = {}) {
        this.gl = gl;
        
        // Creating VAO and buffers
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        // 5 faces (4 triangles + 1 bottom rectangle) = total 16 vertices
        this.vertices = new Float32Array([
            // Front face (v0, v2, v1) -> Top, Bottom-Left, Bottom-Right
            0.0, 1.0, 0.0,   -0.5, 0.0, 0.5,    0.5, 0.0, 0.5,
            // Right face (v0, v1, v4) -> Top, Bottom-Right, Bottom-Back
            0.0, 1.0, 0.0,    0.5, 0.0, 0.5,    0.5, 0.0, -0.5,
            // Back face (v0, v4, v3) -> Top, Bottom-Back, Bottom-Left-Back
            0.0, 1.0, 0.0,    0.5, 0.0, -0.5,  -0.5, 0.0, -0.5,
            // Left face (v0, v3, v2) -> Top, Bottom-Left-Back, Bottom-Left
            0.0, 1.0, 0.0,   -0.5, 0.0, -0.5,  -0.5, 0.0, 0.5,
            // Bottom face (v1, v2, v3, v4) -> CCW looking from bottom (y=-1)
            0.5, 0.0, 0.5,   -0.5, 0.0, 0.5,   -0.5, 0.0, -0.5,   0.5, 0.0, -0.5
        ]);

        // Calculate basic normals for flat shading (approximate mathematically)
        const ny = 0.4472136; // 1 / sqrt(1^2 + 0.5^2 + 0)
        const nxz = 0.8944272; // 0.5 / sqrt(1^2 + 0.5^2 + 0)
        
        this.normals = new Float32Array([
            // Front
            0, ny, nxz,    0, ny, nxz,    0, ny, nxz,
            // Right
            nxz, ny, 0,    nxz, ny, 0,    nxz, ny, 0,
            // Back
            0, ny, -nxz,   0, ny, -nxz,   0, ny, -nxz,
            // Left
            -nxz, ny, 0,  -nxz, ny, 0,   -nxz, ny, 0,
            // Bottom
            0, -1, 0,      0, -1, 0,      0, -1, 0,      0, -1, 0
        ]);

        // 색상은 이제 텍스처로 대체되지만, 셰이더 요구사항을 위해 임의로 할당
        this.colors = new Float32Array(16 * 4);
        this.colors.fill(1.0);

        // Texture Coordinates (u, v)
        // 가로(u)를 0 ~ 0.25 ~ 0.5 ~ 0.75 ~ 1.0 으로 4등분하여 옆면을 감쌈.
        // 세로(v)는 꼭지점(1.0), 밑변(0.0)
        this.texCoords = new Float32Array([
            // Front face (0.0 ~ 0.25)
            // 꼭지점의 u값은 밑변의 중간값 (0.125)
            0.125, 1.0,    0.0, 0.0,      0.25, 0.0,   
            // Right face (0.25 ~ 0.5)
            0.375, 1.0,    0.25, 0.0,     0.5, 0.0,
            // Back face (0.5 ~ 0.75)
            0.625, 1.0,    0.5, 0.0,      0.75, 0.0,
            // Left face (0.75 ~ 1.0)
            0.875, 1.0,    0.75, 0.0,     1.0, 0.0,
            
            // Bottom face (전체 이미지 사용 0.0 ~ 1.0)
            1.0, 1.0,      0.0, 1.0,      0.0, 0.0,      1.0, 0.0
        ]);

        // Total 18 indices (4 triangles * 3) + (1 rect * 6)
        this.indices = new Uint16Array([
            0, 1, 2,      // Front
            3, 4, 5,      // Right
            6, 7, 8,      // Back
            9, 10, 11,    // Left
            12, 13, 14,   14, 15, 12 // Bottom
        ]);

        this.initBuffers();
    }

    initBuffers() {
        const gl = this.gl;

        const vSize = this.vertices.byteLength;
        const nSize = this.normals.byteLength;
        const cSize = this.colors.byteLength;
        const tSize = this.texCoords.byteLength;
        const totalSize = vSize + nSize + cSize + tSize;

        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, totalSize, gl.STATIC_DRAW);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize, this.colors);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize + cSize, this.texCoords);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);  // position
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);  // normal
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize);  // color
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize);  // texCoord

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    draw(shader) {
        const gl = this.gl;
        shader.use();
        gl.bindVertexArray(this.vao);
        // 사각뿔 인덱스 개수 18개에 맞게 렌더링
        gl.drawElements(gl.TRIANGLES, 18, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
}