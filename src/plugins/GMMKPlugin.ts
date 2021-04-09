// copied and adapted from https://github.com/paulguy/gmmkctl
import _Vue from 'vue';

export const GMMK_CMD_START = 0x01;
export const GMMK_CMD_END = 0x02;
export const GMMK_CMD_KEYCOLORS = 0x11;

export const GMMK_CMD_SUBCOMMAND = 6;
export const GMMK_SUBCMD_CMD_OFFSET = 4;
export const GMMK_SUBCMD_ARG_OFFSET = 8;

export const GMMK_PACKET_SIZE = 64;
export const GMMK_COMMAND_OFFSET = 3;
export const GMMK_MAX_KEY = 126;
export const GMMK_SUM_OFFSET = 1;

export const GMMK_KEYCOLORS_COUNT_OFFSET = 4;
export const GMMK_KEYCOLORS_START_OFFSET = 5;
export const GMMK_KEYCOLORS_DATA_OFFSET = 8;
// eslint-disable-next-line max-len
export const GMMK_KEYCOLORS_DATA_SIZE = Math.floor((GMMK_PACKET_SIZE - GMMK_KEYCOLORS_DATA_OFFSET) / 3) * 3;

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export const fillSingleColor = (color: RGBColor, n: number): Array<RGBColor> => {
  // bound n from 0 - Maxkeys
  n = Math.min(GMMK_MAX_KEY, Math.max(n, 0));
  return new Array(n).fill(color);
};

// stolen from GMMKUtil
// I think the leading 4 is the report id
const dataSetProfile = [0x04, 0xdd, 0x03, 0x04, 0x2c, 0x00, 0x00, 0x00, 0x55, 0xaa, 0xff,
  0x02, 0x45, 0x0c, 0x2f, 0x65, 0x00, 0x01, 0x00, 0x08, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x08, 0x07, 0x09,
  0x0b, 0x0a, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x14, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

export class GMMKInterface {
  HIDAvailable: boolean;

  WebHID: HID;

  selectedDevice?: HIDDevice | null;

  buffer: Uint8Array;

  colors: Array<RGBColor>;

  initialized: boolean;

  constructor() {
    // check for HID compatibilty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.WebHID = (navigator as unknown as any).hid;
    this.HIDAvailable = !!this.WebHID;
    this.initialized = false;

    this.buffer = new Uint8Array(GMMK_PACKET_SIZE);
    this.colors = fillSingleColor({ r: 0xff, g: 0xff, b: 0xff }, GMMK_MAX_KEY);
  }

  async connectDevice() : Promise<boolean> {
    // const supportedVIDs = [3141];

    // reset the locally selected device:
    this.selectedDevice = null;

    const devices = await this.WebHID.requestDevice({
      filters: [{
        vendorId: 0x0C45,
        productId: 0x652f,
        // usage: 0x0f,
        usagePage: 0xFF1C,
      }],
    });
    console.log(devices);

    if (devices.length === 0) return false;
    [this.selectedDevice] = devices;

    if (this.selectedDevice) return this.initializeKeyboard();
    return false;
  }

  // TODO this has currently no error checking at all
  // This means the init state inside the store is essentially meaningless.
  async initializeKeyboard() : Promise<boolean> {
    if (!this.selectedDevice) return false;
    if (!this.selectedDevice.opened) await this.selectedDevice.open();
    this.setProfile(1);
    this.setCustomMode();
    this.setRate(3);
    this.setDelay(0);

    this.setKeys(this.colors);

    this.initialized = true;
    return true;
  }

  resetBuffer(): void {
    this.buffer.fill(0);
  }

  async setCustomMode(): Promise<void> {
    await this.setMode(20);
  }

  async setMode(mode: number): Promise<void> {
    this.resetBuffer();

    this.buffer[GMMK_COMMAND_OFFSET] = GMMK_CMD_SUBCOMMAND;
    this.buffer[GMMK_SUBCMD_CMD_OFFSET] = 0x01;
    this.buffer[GMMK_SUBCMD_ARG_OFFSET] = mode;

    // send data
    await this.startCommand();
    await this.write(this.buffer);
    await this.endCommand();
  }

  // // Public
  async setProfile(profile: 1 | 2 | 3): Promise<void> {
    if (!this.selectedDevice) return;
    // profile = Math.min(3, Math.max(1, profile));
    const message = [...dataSetProfile];
    message[18] = profile - 1;
    await this.startCommand();
    await this.write(new Uint8Array(message));
    await this.endCommand();
  }

  async setDelay(delay: number): Promise<void> {
    delay = Math.max(0, Math.min(delay, 0xff));
    this.resetBuffer();

    await this.startCommand();
    this.buffer[GMMK_COMMAND_OFFSET] = GMMK_CMD_SUBCOMMAND;
    this.buffer[GMMK_SUBCMD_CMD_OFFSET] = 0x01;
    this.buffer[GMMK_SUBCMD_CMD_OFFSET + 1] = 0x02;
    this.buffer[GMMK_SUBCMD_ARG_OFFSET] = delay;
    await this.write(this.buffer);
    await this.endCommand();
  }

  async setRate(rate: number): Promise<void> {
    this.resetBuffer();

    await this.startCommand();
    this.buffer[GMMK_COMMAND_OFFSET] = GMMK_CMD_SUBCOMMAND;
    this.buffer[GMMK_SUBCMD_CMD_OFFSET] = 0x01;
    this.buffer[GMMK_SUBCMD_CMD_OFFSET + 1] = 0x0f;
    this.buffer[GMMK_SUBCMD_ARG_OFFSET] = rate;
    await this.write(this.buffer);
    await this.endCommand();
  }

  // without tuning, this takes around 369.05ms for a full refresh
  // buffer resets roughly take an additional 9ms
  async setKeys(colors: Array<RGBColor>): Promise<void> {
    if (!this.initialized) return;
    const start = 0;
    const count = colors.length;
    // console.time('rgbkbdwrite');
    await this.startCommand();

    // const keysPerTransfer = Math.floor(GMMK_KEYCOLORS_DATA_SIZE/3)
    // this.resetBuffer();
    for (let i = 0; i < count;) {
      // this.buffer[0] = 0x04;
      this.buffer[GMMK_COMMAND_OFFSET] = GMMK_CMD_KEYCOLORS;
      this.buffer[GMMK_KEYCOLORS_COUNT_OFFSET] = ((count - i) * 3 > GMMK_KEYCOLORS_DATA_SIZE)
        ? GMMK_KEYCOLORS_DATA_SIZE : (count - i) * 3;
      const bytesRemaining = (count - i) * 3;
      // console.log(`${bytesRemaining} bytes still left to send`)
      const bytesToBeSent = Math.min(GMMK_KEYCOLORS_DATA_SIZE, bytesRemaining);
      const keysToBeSent = bytesToBeSent / 3;
      this.buffer[GMMK_KEYCOLORS_COUNT_OFFSET] = bytesToBeSent;

      // note that the offset actually get's bigger than 255
      // so this is actually needed.
      const offset = (start * 3) + (i * 3);
      this.buffer[GMMK_KEYCOLORS_START_OFFSET] = offset & 0xff;
      this.buffer[GMMK_KEYCOLORS_START_OFFSET + 1] = (offset >> 8);

      // Format the data into the buffer to bve sent
      for (let j = 0; j < bytesToBeSent; j += 3) {
        // console.log(count, i, i + Math.floor(j/3))
        this.buffer[GMMK_KEYCOLORS_DATA_OFFSET + j + 0] = colors[i + Math.floor(j / 3)].r;
        this.buffer[GMMK_KEYCOLORS_DATA_OFFSET + j + 1] = colors[i + Math.floor(j / 3)].g;
        this.buffer[GMMK_KEYCOLORS_DATA_OFFSET + j + 2] = colors[i + Math.floor(j / 3)].b;
      }

      // eslint-disable-next-line no-await-in-loop
      await this.write(this.buffer);
      i += keysToBeSent;
      // console.log(`${bytesToBeSent} bytes sent ->
      // ${bytesToBeSent / 3} keys | ${count - i} remaining`);
    }
    await this.endCommand();
    // console.timeEnd('rgbkbdwrite');
  }

  // // private

  // uses the variant from GMMK util, for now.

  async startCommand(): Promise<void> {
    // this.resetBuffer();
    this.buffer[GMMK_COMMAND_OFFSET] = GMMK_CMD_START;
    await this.write(this.buffer);
  }

  // // uses the variant from GMMK util, for now.
  async endCommand(): Promise<void> {
    // this.resetBuffer();
    this.buffer[GMMK_COMMAND_OFFSET] = GMMK_CMD_END;
    await this.write(this.buffer);
  }

  async write(buffer: Uint8Array): Promise<void> {
    if (!this.selectedDevice) return;

    // console.log('____')
    // console.log('Before Checksum')
    // console.log(buffer)
    buffer[0] = 0x04;
    const sum = buffer.slice(GMMK_COMMAND_OFFSET).reduce((acc, e) => acc + e) & 0xffff;
    buffer[GMMK_SUM_OFFSET] = sum & 0xff;
    buffer[GMMK_SUM_OFFSET + 1] = (sum >> 8) & 0xff;
    // console.log('After Checksum')
    // console.log(buffer)
    // console.log('____')
    await this.selectedDevice.sendReport(0x04, buffer.slice(1));
  }
}

// export type PluginFunction<T> = (Vue: typeof _Vue, options?: T) => void;
export function GMMKPlugin(Vue: typeof _Vue): void {
  // eslint-disable-next-line no-param-reassign
  Vue.prototype.$gmmkInterface = new GMMKInterface();
}
