import { lcm, minMultF2I, deduplicateArray } from '@/lib/utils';

/* eslint-disable */

import QMK_ISO_KEYMATRIX from '@/assets/oem_iso_fullsize.json';
import QMK_ISO_KEYMAP from '@/assets/iso_fullsize_default_layout.json';

import GMMK_ISO_MAP from '!raw-loader!@/assets/keymap-DE-ISO-fullsize.txt';

// Mathematical helpers

// converts the given float into the smallest integer without loss of precision
// const F2I_swl = (num) => {
//   return minMultF2I(num) * num;
// }


/* Interfaces */
interface SimpleKeyboardMapElement {
  keyIndex: number;
}

interface SimpleKeyboardMap extends Array<Array<SimpleKeyboardMapElement>> {
  shape?: Array<number>;
};

interface QMKKey { 
  x: number;
  y:number;
  w?: number;
  h?: number;
  label: string;
}

interface QMKKeyboardDescriptor {
  git_hash: string;
  keyboards: {
    [key: string]: {
      keyboard_name: string;
      layouts: { 
        [key: string]: {
          key_count: number;
          layout: Array<{x: number, y:number, w?: number, h?: number, label: string}>;
        }
      }
    }
  }
  last_updated: string;
}

interface QMKKeyboardMap {
  commit: string;
  keyboard: string;
  keymap: string;
  layers: Array<Array<String>>;
}

export interface MappedKey {
  x: number;
  y:number;
  w: number;
  h: number;
  label: string;

  keyIndex: number;

  center: {
    x: number;
    y: number;
  }
}

export interface KeyboardMatrix extends Array<Array<MappedKey>> {
  shape?: Array<number>;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const getKeyboardMapfromQMKJson = (descriptor: QMKKeyboardDescriptor, map: QMKKeyboardMap): Array<QMKKey> => {
  const kbdName = map.keyboard;

  const { keyboards } = descriptor;
  const { layouts } = keyboards[kbdName];
  const layout_names = Object.keys(layouts);

  return layouts[layout_names[0]].layout.map((e: any, i: number) => {
    // Override the label with the defaults, for debugging.
    const label = map.layers[0][i];
    return { ...e, label };
  });
};

const matrixifyQMK = (qmkLayout: Array<QMKKey>): Array<Array<QMKKey>> => {
  const yValues = deduplicateArray(qmkLayout.map((e) => e.y));
  // const xValues = deduplicateArray(simplifiedLayout.map(e => e.x));

  const qmkMatrix = yValues.map((y, y_index) => qmkLayout
    .filter((e: any) => e.y === y)
    .map((e: any, x_index: any) => ({ x_index, y_index, ...e })));
  return qmkMatrix;
};


const parseTextKeyboardMap = (map: string): SimpleKeyboardMap => {
  const elements = map.split('\n')
    .map((row: any) => row.split(/\s+/).filter((element: string) => !!element))
    .filter((e: any) => !!e.length);

  // We actually only care about the index-rows
  const index_rows = elements.filter((e, i) => i % 2 === 1);
  const kbdMap: SimpleKeyboardMap  = [];

  const mapWidth = Math.max(...index_rows.map((e) => e.length));
  const mapHeight = index_rows.length;

  // console.log(`Your keyboard essentially is a wonky ${size_x}x${size_y} monitor :)`)
  for (let y = 0; y < mapHeight; y++) {
    const row = [];
    for (let x = 0; x < mapWidth; x++) {
      const keyIndex = (index_rows[y].length > x) ? parseInt(index_rows[y][x]) : -1;
      row.push({ keyIndex });
    }
    kbdMap.push(row);
  }

  kbdMap.shape = [mapHeight, mapWidth];

  return kbdMap;
}

export const generateMap = () => {
  // console.log('mapping...');

  // While the pure GMMK ISO map gives us a rough estimated where the keys are
  // This cannot be used for proper graphics.
  // Since the keys are not simply linearly spaced in x and y.

  // First the GMMK map is used to get key a key-position matrix
  // This is used with the ISO OEM map to get the actual positions

  // Which then can be used to generat a bitmap and a key-mapping for that bitmap :)

  // Load and matrixify the gmmk keymap
  const gmmk_keymap = parseTextKeyboardMap(GMMK_ISO_MAP);

  // load and matrxify the corresponding QMK keymap
  const qmk_layout = getKeyboardMapfromQMKJson(QMK_ISO_KEYMATRIX, QMK_ISO_KEYMAP);
  const qmkMatrix = matrixifyQMK(qmk_layout);

  // match up the matrixes
  const combinedMatrix: KeyboardMatrix = [];
  if (!gmmk_keymap.shape) return;
  for (let y = 0; y < gmmk_keymap.shape[0]; y++) {
    const combined_row = [];
    for (let x = 0; x < gmmk_keymap.shape[1]; x++) {
      const { keyIndex } = gmmk_keymap[y][x];
      const qmkElement = qmkMatrix[y][x];
      const qmkMapperExists = !!qmkElement;

      const key_x = (qmkMapperExists) ? qmkElement.x : -1;
      const key_y = (qmkMapperExists) ? qmkElement.y : -1;
      const key_w = (qmkMapperExists) ? qmkElement.w ?? 1 : -1;
      const key_h = (qmkMapperExists) ? qmkElement.h ?? 1 : -1;
      const label = (qmkMapperExists) ? qmkElement.label : '';

      const center = { x: key_x + (key_w / 2), y: key_y + (key_h / 2) };

      const keyInfo = {
        x: key_x, y: key_y, w: key_w, h: key_h, label, keyIndex, center,
      };
      combined_row.push(keyInfo);
    }
    combinedMatrix.push(combined_row);
  }

  combinedMatrix.shape = gmmk_keymap.shape;


  // since we know all the keys sizes (w & h) and positions

  const tmpMap = combinedMatrix.flat();

  // calculate the keyboard's bounding-box.
  const min_x = Math.min(...tmpMap.map((e) => e.x));
  const max_x = Math.max(...tmpMap.map((e) => e.x + e.w));

  const min_y = Math.min(...tmpMap.map((e) => e.y));
  const max_y = Math.max(...tmpMap.map((e) => e.y + e.h));

  const bitmap_scl_x = lcm(minMultF2I(min_x), minMultF2I(max_x));
  const bitmap_scl_y = lcm(minMultF2I(min_y), minMultF2I(max_y));
  const kbdBitmapSize = {
    x: (max_x - min_x) * bitmap_scl_x, y: (max_y - min_y) * bitmap_scl_y, bitmap_scl_x, bitmap_scl_y,
  };

  combinedMatrix.boundingBox = {
    x: min_x,
    y: min_y,
    width: max_x - min_x,
    height: max_y - min_y
  }

  // console.log(allKeys)
  return {
    combinedMatrix, kbdBitmapSize
  };
};
