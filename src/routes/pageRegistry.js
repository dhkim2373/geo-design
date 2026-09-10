// src/routes/pageRegistry.js
import React from 'react';
import MainDashboard from '@/pages/Home/MainDashboard';
import BuildingManagement from '@/pages/Building/BuildingManagement';

// 미개발 화면용 기본 플레이스홀더
const ReadyPage = ({ title, url, menuId }) => (
  <div style={{ padding: 24, background: '#fff', height: '100%' }}>
    <h3>{title}</h3>
    <p style={{ color: '#888' }}>
      화면 ID: <b>{menuId}</b> | 넥사크로 URL: <code>{url}</code>
    </p>
    <div style={{ marginTop: 20, color: '#1890ff' }}>화면 개발 진행 중입니다.</div>
  </div>
);

// 1. URL(.xfdl) 기준 매핑 (최우선)
export const URL_COMPONENT_MAP = {
  '': MainDashboard, // URL이 없으면 대시보드
  'service_building::bld_건축물대장조회.xfdl': BuildingManagement,
};

// 2. MENU_ID 기준 보조 매핑
export const MENU_ID_COMPONENT_MAP = {
  HOME: MainDashboard,
  C0020: BuildingManagement, // 건축물대장조회
};

/**
 * 메뉴 레코드 정보를 받아 알맞은 리액트 컴포넌트를 반환하는 팩토리 함수
 */
export function getComponentByMenu(menuRow) {
  if (!menuRow) return MainDashboard;

  const url = menuRow.URL || '';
  const menuId = menuRow.MENU_ID || '';

  // 1) URL 경로로 매핑된 컴포넌트 찾기
  if (url && URL_COMPONENT_MAP[url]) {
    return URL_COMPONENT_MAP[url];
  }

  // 2) MENU_ID로 매핑된 컴포넌트 찾기
  if (menuId && MENU_ID_COMPONENT_MAP[menuId]) {
    return MENU_ID_COMPONENT_MAP[menuId];
  }

  // 3) 아직 작성되지 않은 화면이면 안내 화면 컴포넌트 반환
  return () => (
    <ReadyPage
      title={menuRow.MENU_LABEL || menuId}
      url={url}
      menuId={menuId}
    />
  );
}