import type { RouteRecordRaw } from 'vue-router'

export const mainRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/anime/:id',
    name: 'anime',
    component: () => import('@/views/AnimeView.vue')
  },
  {
    path: '/player/:id',
    name: 'player',
    component: () => import('@/views/PlayerView.vue'),
    props: true
  }
]
