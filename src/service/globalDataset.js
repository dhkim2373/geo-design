// src/service/globalDataset.js
import { NexacroDataset } from './nexacroDataset';

// 1. 넥사크로 전역 데이터셋(gds_*) 인스턴스 생성
export const gds_allCompany   = new NexacroDataset('gds_allCompany');   // 전체 회사 목록
export const gds_userInfo     = new NexacroDataset('gds_userInfo');     // 사용자 세션 및 정보
export const gds_menu         = new NexacroDataset('gds_menu');         // 메뉴 트리 목록
export const gds_button       = new NexacroDataset('gds_button');       // 화면별 버튼 권한
export const gds_message      = new NexacroDataset('gds_message');      // 시스템 메시지 매핑
export const gds_favorite     = new NexacroDataset('gds_favorite');     // 즐겨찾기 메뉴 목록
export const gds_grpQueryCond = new NexacroDataset('gds_grpQueryCond'); // 그룹 쿼리 조건
export const gds_authCompany  = new NexacroDataset('gds_authCompany');  // 권한 부여된 회사 목록
export const gds_authStore    = new NexacroDataset('gds_authStore');    // 권한 창고/점포 목록

// 2. 전체 전역 데이터셋 딕셔너리
export const globalDatasets = {
  gds_allCompany,
  gds_userInfo,
  gds_menu,
  gds_button,
  gds_message,
  gds_favorite,
  gds_grpQueryCond,
  gds_authCompany,
  gds_authStore,
};

// 3. 글로벌 변경 감지 리스너
const listeners = new Set();

export const subscribeGlobalDataset = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notifyGlobalDatasetChange = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('글로벌 데이터셋 리스너 실행 오류:', e);
    }
  });
};

// 4. 로그아웃 시 전체 초기화 유틸
export const clearAllGlobalDatasets = () => {
  Object.values(globalDatasets).forEach((ds) => ds.clearData());
  notifyGlobalDatasetChange();
};