import { GMMKInterface } from '@/plugins/GMMKPlugin';
import _webHID from '@types/w3c-web-hid';

declare module 'vue/types/vue' {
  interface Vue {
    $gmmkInterface: GMMKInterface;
  }
}
