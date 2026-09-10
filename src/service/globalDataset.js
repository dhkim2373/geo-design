import { NexacroDataset } from './NexacroDataset';

// 넥사크로 전역 글로벌 데이터셋 정의
export const gds_userInfo = new NexacroDataset('gds_userInfo');
export const gds_menu = new NexacroDataset('gds_menu');
export const gds_button = new NexacroDataset('gds_button');
export const gds_favorite = new NexacroDataset('gds_favorite');

// 변경 감지용 전역 리스너
const listeners = new Set();

export const notifyGlobalDatasetChange = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeGlobalDataset = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// 넥사크로 application 스코프처럼 window 객체에도 바인딩 (개발자도구 디버깅 지원)
if (typeof window !== 'undefined') {
  window.application = {
    gds_userInfo,
    gds_menu,
    gds_button,
    gds_favorite,
  };
}