<template lang="pug">
.streamer-wrapper
  .info-wrapper(:class="showPreview? 'hidden' : ''")
    h1 GMMK Ambilight
    h2 A WebHID experiment
    .text-wrapper
      span Under the hood a hacky combination of DesktopStreaming is used with the
      b amazing
      span WebHID interface, to communicate directly from the browser to the Keyboard.
      span This works best (and I think only) on Chrome.
      span And with a GMMK keyboard (Maybe others work too?).
      span This project's HID code is
      span.crossed stolen
      span heavily inspired by multiple other projects -
      span most notably
      a(href="https://github.com/paulguy/gmmkctl") gmmkctl
      span and
      a(href="https://github.com/dokutan/rgb_keyboard") rgb_keyboard
      span - definitely check them out, they're very cool projects and without them
      span this little experiment would not exist.
      br
      br
      span But enough information - let's get to the cool stuff!
      br
      span To get started, simply select your keyboard and video input.
  .setup-wrapper
    GSButton(
      @click="selectHIDDevice"
      text="Select keyboard"
      v-if="!showPreview")
      template(v-slot:icon)
        KeyboardIcon(:size="48")
    GSButton(
      @click="selectDesktopSource"
      text="Select Screen"
      v-if="!showPreview"
      :disabled="sourceSelectButtonDisabled")
      template(v-slot:icon)
        DisplayShareIcon(:size="48")
    GSButton(
      @click="stopStream"
      text="Stop Stream"
      v-if="displayStreamStarted")
      template(v-slot:icon)
        StopIcon(:size="48")
    GSButton(
      @click="toggleKeyboardPreview"
      text="Toggle Keyboard preview"
      v-if="displayStreamStarted")
      template(v-slot:icon)
        ShowKeyboardPreviewIcon(:size="48")
  .video-container(:class="showPreview? '' : 'hidden'")
    .preview-element
      h1 Input Video Preview
      video(ref="videoPreview")
    .preview-element
      h1 Keyboard output

      .canvas-wrapper
        canvas(ref="previewCanvas")
        .overlay(v-if="showKeyPreview")
        .key-preview(
          v-if="showKeyPreview"
          v-for="key in keyMatrix.flat()"
          :style="keyStyles.get(key.keyIndex)")
          .text {{ key.label }}

</template>

<script lang="ts">
import { Vue } from 'vue-property-decorator';
import { generateMap, MappedKey } from '@/lib/libMap';

import { createShader, createTexture } from '@/lib/libGL';
import { gaussian, linspace } from '@/lib/utils';

import { GMMK_MAX_KEY } from '@/plugins/GMMKPlugin';

import KeyboardIcon from 'vue-material-design-icons/KeyboardSettings.vue';
import DisplayShareIcon from 'vue-material-design-icons/MonitorShare.vue';
import StopIcon from 'vue-material-design-icons/Stop.vue';
import ShowKeyboardPreviewIcon from 'vue-material-design-icons/CardSearchOutline.vue';
import GSButton from '@/components/GSButton.vue';

// eslint-disable-next-line import/no-webpack-loader-syntax
import blurFragShader from '!raw-loader!@/shaders/blur.frag';
// eslint-disable-next-line import/no-webpack-loader-syntax
import blurVertShader from '!raw-loader!@/shaders/blur.vert';

// Icons

// Custom components

interface HomeData {
  desktopMediaStream: MediaStream | null;

  gl: WebGLRenderingContext | null;
  glInitialized: boolean;
  shaderProgram: WebGLProgram | null;

  kbdBitmapSize: any;
  keyMatrix: any;
  canvasResolution: Array<number>;

  sigma: number;
  isStreaming: boolean;

  pixelBuffer: Uint8Array | null;

  // State:
  keyboardInitialized: boolean;
  displayStreamStarted: boolean;

  showKeyPreview: boolean;

  canvasSize: { width: number, height: number };
}

export default Vue.extend({
  data() : HomeData {
    return {
      desktopMediaStream: null,
      gl: null,
      glInitialized: false,
      shaderProgram: null,

      kbdBitmapSize: null,
      keyMatrix: [],
      canvasResolution: [0, 0],

      sigma: 0.1,
      isStreaming: true,
      pixelBuffer: null,

      // UI State
      keyboardInitialized: false,
      displayStreamStarted: false,
      showKeyPreview: false,
      canvasSize: { width: 0, height: 0 },
    };
  },
  components: {
    KeyboardIcon,
    GSButton,
    DisplayShareIcon,
    ShowKeyboardPreviewIcon,
    StopIcon,
  },
  mounted() {
    const maps = generateMap();
    this.kbdBitmapSize = maps?.kbdBitmapSize;
    this.keyMatrix = maps?.combinedMatrix;

    window.addEventListener('resize', this.resizeListener);
  },

  computed: {
    sourceSelectButtonDisabled(): boolean {
      if (!this.keyboardInitialized) return true;
      return this.displayStreamStarted;
    },

    showPreview(): boolean {
      return this.keyboardInitialized && this.displayStreamStarted;
    },

    keyStyles(): Map<number, any> {
      return new Map(this.keyMatrix.flat().map((key: MappedKey) => {
        const { width, height } = this.canvasSize;
        const capSize = Math.min(width / this.keyMatrix.boundingBox.width,
          height / this.keyMatrix.boundingBox.height);

        return [key.keyIndex, {
          position: 'absolute',
          left: `${key.x * capSize}px`,
          top: `${key.y * capSize}px`,
          width: `${key.w * capSize}px`,
          height: `${key.h * capSize}px`,
        }];
      }));
    },
  },
  methods: {
    async selectHIDDevice(): Promise<void> {
      const result = await this.$gmmkInterface.connectDevice();
      this.keyboardInitialized = result;
    },

    async selectDesktopSource(): Promise<void> {
      const screen = await (navigator.mediaDevices as any)
        .getDisplayMedia({ audio: false, video: true });
      this.desktopMediaStream = screen;

      if (this.desktopMediaStream) {
        const videoPreview = this.$refs.videoPreview as HTMLVideoElement;
        videoPreview.srcObject = this.desktopMediaStream;
        videoPreview.onloadedmetadata = () => {
          videoPreview.play();
          this.displayStreamStarted = true;
          setTimeout(this.initStreamer, 0);
        };

        this.desktopMediaStream.getVideoTracks()[0].addEventListener('ended', () => {
          this.displayStreamStarted = false;
        });
      }
    },

    initStreamer(): void {
      this.init_webGL();
      setTimeout(this.webgl_process_frame, 100);
    },

    init_webGL(): void {
      const video = this.$refs.videoPreview as HTMLVideoElement;
      if (!this.gl) {
        const canvas = this.$refs.previewCanvas as HTMLCanvasElement;
        canvas.width = this.kbdBitmapSize.x;
        canvas.height = this.kbdBitmapSize.y;

        this.canvasResolution = [canvas.width, canvas.height];
        this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
      }
      const { gl } = this;
      if (!gl) return;

      const vertexShader = createShader(gl, blurVertShader, 'vert');
      const fragmentShader = createShader(gl, blurFragShader, 'frag');
      if (!vertexShader || !fragmentShader) return;

      this.shaderProgram = gl.createProgram();
      if (!this.shaderProgram) return;
      gl.attachShader(this.shaderProgram, vertexShader);
      gl.attachShader(this.shaderProgram, fragmentShader);
      gl.linkProgram(this.shaderProgram);

      /*= ========= Defining and storing the geometry ========= */

      const vertexArray = new Float32Array([
        -1, 1,
        -1, -1,
        1, -1,
        1, 1,
      ]);

      const uv = new Float32Array([
        0, 0,
        0, 1,
        1, 1,
        1, 0,
      ]);

      const indices = [3, 2, 1, 3, 1, 0];
      const shaderProgram = this.shaderProgram as any;
      shaderProgram.nIndices = indices.length;

      // Create an empty buffer object to store vertex buffer
      shaderProgram.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, shaderProgram.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);

      // Create UV Buffer
      shaderProgram.UVBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, shaderProgram.UVBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);

      // Create an empty buffer object to store Index buffer
      shaderProgram.IndexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shaderProgram.IndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

      // create video texture:
      shaderProgram.videoTexture = createTexture(gl, video);
    },

    // GL Post-processing
    webgl_process_frame(): void {
      console.log('processing webgl frame');
      const video = this.$refs.videoPreview as HTMLVideoElement;
      const canvas = this.$refs.previewCanvas as HTMLCanvasElement;
      if (!this.gl) this.init_webGL();
      const { gl } = this;
      if (!gl) return;
      gl.useProgram(this.shaderProgram);

      /* ======= Associating shaders to buffer objects ======= */

      const shaderProgram = this.shaderProgram as any;

      // Bind vertex buffer object
      gl.bindBuffer(gl.ARRAY_BUFFER, shaderProgram.vertexBuffer);
      const vertexBufferCoord = gl.getAttribLocation(shaderProgram, 'coordinates');
      gl.vertexAttribPointer(vertexBufferCoord, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(vertexBufferCoord);

      // Bind uv buffer object
      gl.bindBuffer(gl.ARRAY_BUFFER, shaderProgram.UVBuffer);
      const uvBufferCoord = gl.getAttribLocation(shaderProgram, 'uv_coordinates');
      gl.vertexAttribPointer(uvBufferCoord, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(uvBufferCoord);

      // Bind index buffer object
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shaderProgram.IndexBuffer);

      // Bind the texture:
      // Tell WebGL we want to affect texture unit 0
      gl.uniform1i(gl.getUniformLocation(shaderProgram, 'uSampler'), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, shaderProgram.videoTexture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video as any);
      } catch (error) {
        setTimeout(this.webgl_process_frame, 100);
        return;
      }

      // bind the resolution uniform:
      gl.uniform2f(gl.getUniformLocation(shaderProgram, 'resolution'), this.canvasResolution[0], this.canvasResolution[1]);

      // construct gaussian kernel

      const kernelSize = 16;
      const { sigma } = this;
      const kernel = linspace(-1, 1, kernelSize)
        .map((x) => gaussian(x, 0, sigma));

      gl.uniform1fv(gl.getUniformLocation(shaderProgram, 'kernel'), kernel);

      /*= ============ Drawing the Quad ================ */

      // Clear the canvas
      gl.clearColor(0.5, 0.5, 0.5, 1.0);
      // gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawElements(gl.TRIANGLES, shaderProgram.nIndices, gl.UNSIGNED_SHORT, 0);
      gl.flush();

      setTimeout(this.download_image, 0);
    },

    // image -> kbd interface:
    async download_image(): Promise<void> {
      // console.log('downloading frame');
      const { gl } = this;
      if (!gl) return;
      // console.log(`GL Framebuffer size: ${gl.drawingBufferWidth} x ${gl.drawingBufferHeight}`);
      // console.log(`That's : ${gl.drawingBufferWidth * gl.drawingBufferHeight * 4} elements`);

      if (!this.pixelBuffer) {
        this.pixelBuffer = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      }

      gl.readPixels(0, 0, gl.drawingBufferWidth,
        gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, this.pixelBuffer);
      const keyColors = new Array(GMMK_MAX_KEY).fill({ r: 0, g: 0, b: 0 });

      const [sy, sx] = this.keyMatrix.shape;
      // const sx = this.keyMatrix[0].length;

      const [canvasWidth, canvasHeight] = this.canvasResolution;
      const stepX = canvasWidth / sx;
      const stepY = canvasHeight / sy;

      for (let y = 0; y < sy; y += 1) {
        for (let x = 0; x < sx; x += 1) {
          const { keyIndex, center } = this.keyMatrix[y][x];
          // eslint-disable-next-line no-continue
          if (keyIndex === -1) continue;
          const px = Math.floor(center.x * stepX);
          const py = Math.floor(center.y * stepY);

          // console.log(px, py, keyIndex);
          const idx = (px + (py * gl.drawingBufferWidth)) * 4;

          keyColors[keyIndex - 1] = {
            r: this.pixelBuffer[idx],
            g: this.pixelBuffer[idx + 1],
            b: this.pixelBuffer[idx + 2],
          };
        }
      }
      // console.log(this.pixelBuffer);
      // console.log(keyColors);
      await this.$gmmkInterface.setKeys(keyColors);

      // request next frame:
      // this.renderInterval = setTimeout(this.)
      if (this.isStreaming) setTimeout(this.webgl_process_frame, 500);
      // else this.shutdown();
    },

    // Stream control
    stopStream(): void {
      // if the stream was open, close it properly
      if (this.desktopMediaStream) {
        this.desktopMediaStream.getTracks()
          .forEach((track: MediaStreamTrack) => track.stop());
      }
      this.isStreaming = false;
      this.desktopMediaStream = null;
      this.displayStreamStarted = false;
    },

    toggleKeyboardPreview(): void {
      this.showKeyPreview = !this.showKeyPreview;
    },

    resizeListener(): void {
      if (!this.$refs.previewCanvas) return;
      const { width, height } = (this.$refs.previewCanvas as HTMLElement).getBoundingClientRect();
      this.canvasSize = { width, height };
    },
  },

  beforeDestroy() {
    this.stopStream();
    window.removeEventListener('resize', this.resizeListener);
  },

  watch: {
    showPreview() {
      this.$nextTick(this.resizeListener);
    },
  },

});
</script>

<style lang="scss" scoped>

.streamer-wrapper {
  width: 100%;
  height: 100%;

  display: flex;
  flex-direction: column;
  justify-content: center;

  & > * {
    overflow: hidden;
  }

  .setup-wrapper {
    height: auto;

    padding: 0.5rem 5rem;
    .gsbutton {
      min-width: 300px;
    }
  }

  transition:  height 300ms ease-in-out;
}

.video-container {
  flex: 1 1 0;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-items: center;

  margin: 0 0 2rem 0;

  .preview-element {
    flex: 1 1 0;
    margin: 1rem 0;

    display: flex;
    flex-direction: column;

    h1 {
      font-weight: 800;
    }

    .canvas-wrapper,
    video {
      border-radius: 8px;
      width: 80%;
      max-width: 800px;

      margin: 1rem auto;
      overflow: hidden;

      & > canvas {
        width: 100%;
      }
    }
  }

  transition: all 500ms ease-in-out
}

.canvas-wrapper {
  position: relative;

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    background: rgba(0, 0, 0, 0.5);
  }

  .key-preview {
    color: #fff;
    outline: 1px solid #fff;
    display: flex;
    .text {
      font-size: 0.6rem;
      margin: auto;
      user-select: none;
    }
  }
}

.hidden {
  height: 0 !important;
  flex: 0  !important;
  margin: 0 !important;
}

.info-wrapper {
  align-self: flex-start;
  margin: 1rem auto;

  .text-wrapper {
    margin: 0 2rem;
    max-width: 800px;
    text-align: justify;
    b,
    a,
    span {
      &::before,
      &::after {
        content: " ";
        text-decoration: none;
      }
    }

    a {
      text-decoration: none;
    }

    .crossed {
      text-decoration: line-through;
    }
  }
}

</style>
