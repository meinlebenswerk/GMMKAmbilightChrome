// WebGL helpers
export const createShader = (gl: WebGLRenderingContext, source: string, type: 'frag' | 'vert'): WebGLShader | null => {
  let shaderType;
  switch (type) {
    case 'frag':
      shaderType = gl.FRAGMENT_SHADER;
      break;
    default:
    case 'vert':
      shaderType = gl.VERTEX_SHADER;
      break;
  }

  const shader = gl.createShader(shaderType);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const compileMsg = gl.getShaderInfoLog(shader);
  if (compileMsg) console.log(`${type} shader compiled with error: ${compileMsg}`);

  return shader;
};

// eslint-disable-next-line max-len
export const createTexture = (gl: WebGLRenderingContext, size: { offsetWidth: number, offsetHeight: number}) : WebGLTexture | null => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.offsetWidth,
    size.offsetHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return texture;
};
