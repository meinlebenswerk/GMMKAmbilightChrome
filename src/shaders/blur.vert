attribute vec2 coordinates;
attribute vec2 uv_coordinates;

varying vec2 uv;

void main(void) {
	// uv = tex;
	// gl_Position = vec4(vec3(x, 1) * view, 1);
  gl_Position = vec4(coordinates, 0.0, 1.0);
  uv = uv_coordinates;
}