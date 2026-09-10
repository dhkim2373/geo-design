import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import React from 'react';

// 글로벌 초기화 데이터 설정
export async function getInitialState(): Promise<{ name: string; userId: string }> {
  return { 
    name: '테스트부동산',
    userId: 'REDBOMBZ'
  };
}

// Ant Design 전역 언어를 한국어로 설정 (테이블 페이징, 달력 등 한글화 유지)
export function rootContainer(container: React.ReactNode) {
  return React.createElement(
    ConfigProvider,
    { locale: koKR },
    container
  );
}