import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('@/views/SignIn.vue'),
  },
  {
    path: '/sign-up',
    name: 'sign-up',
    component: () => import('@/views/SignUp.vue'),
  },
]
