attribute vec2 a_position;
uniform vec2 u_translation;

void main() {
    // 이동할 좌표(u_translation)를 원래 좌표(a_position)에 더해줍니다.
    gl_Position = vec4(a_position + u_translation, 0.0, 1.0);
}