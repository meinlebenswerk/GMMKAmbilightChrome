import Vue from 'vue';
import { GMMKPlugin } from '@/plugins/GMMKPlugin';
import { ReactiveRefs } from 'vue-reactive-refs';

import App from './App.vue';
import './registerServiceWorker';
import router from './router';
import store from './store';

Vue.config.productionTip = false;
Vue.use(GMMKPlugin);
Vue.use(ReactiveRefs);

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');
