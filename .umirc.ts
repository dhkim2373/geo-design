import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  
  // Umi 기본 레이아웃 끄기 (우리가 만든 MdiLayout 사용)
  layout: false,

  // 7000번 React 개발서버 -> 8080번 FSP 백엔드 서버 프록시 연결
  proxy: {
    '/NMain': {
      target: 'https://tpl.geoweb.kr',
      changeOrigin: true,
    },
    '/downloadWeb': {
      target: 'https://tpl.geoweb.kr',
      changeOrigin: true,
    },
  },

  routes: [
    {
      path: '/',
      component: '@/layouts/mdiLayout',
    },
    {
      path: '/*',
      redirect: '/',
    },
  ],
  npmClient: 'npm',
});