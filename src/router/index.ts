import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';
import Streamer from '../views/Streamer.vue';

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'Streamer',
    component: Streamer,
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes,
});

export default router;
