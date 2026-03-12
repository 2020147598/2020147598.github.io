// Global constants
const canvas = document.getElementById('glCanvas'); // Get the canvas element 
const gl = canvas.getContext('webgl2'); // Get the WebGL2 context

if (!gl) {
    console.error('WebGL 2 is not supported by your browser.');
}

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Initialize WebGL settings: viewport and clear color


gl.enable(gl.SCISSOR_TEST);
gl.scissor(0,0,250,250);
gl.clearColor(0,0,1,1);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.scissor(250,0,250,250);
gl.clearColor(1,1,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.scissor(0,250,250,250);
gl.clearColor(0,1,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.scissor(250,250,250,250);
gl.clearColor(1,0,0,1);
gl.clear(gl.COLOR_BUFFER_BIT);
// Start rendering
render();

// Render loop
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);    
    // Draw something here
}

// Resize viewport when window size changes
window.addEventListener('resize', () => {

    const size = Math.min(window.innerWidth, window.innerHeight);

    canvas.width = size;
    canvas.height = size;

    gl.viewport(0, 0, canvas.width, canvas.height);

    let w = canvas.width / 2;
    let h = canvas.height / 2;

    gl.enable(gl.SCISSOR_TEST);

    gl.scissor(0, 0, w, h);
    gl.clearColor(0,0,1,1); // blue
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(w, 0, w, h);
    gl.clearColor(1,1,0,1); // yellow
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(0, h, w, h);
    gl.clearColor(0,1,0,1); // green
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.scissor(w, h, w, h);
    gl.clearColor(1,0,0,1); // red
    gl.clear(gl.COLOR_BUFFER_BIT);

});



