
precision mediump float;
varying vec2 uv;

uniform sampler2D uSampler;
uniform vec2 resolution;

uniform float kernel[16];

const int size = 16;

void main(void) {
  vec2 step = 1.0/resolution;
  vec4 color = vec4(0.0);

  float kernel_mag = 0.0;

  for(int x=0; x < size; x +=1) {
    for(int y=0; y < size; y +=1) {
      vec2 offset = vec2(float(x), float(y)) - vec2(float(size) / 2.0);
      float kernel_val = kernel[x] * kernel[y];
      kernel_mag += kernel_val;
      color += kernel_val * texture2D(uSampler, uv + offset*step);
    }
  }

  color /= kernel_mag;

  gl_FragColor = color;
}