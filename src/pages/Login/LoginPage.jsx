import React, { useState, useEffect, useRef } from 'react';
import { Input, Checkbox, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { FspClient } from '@/service/FspClient';
import { NexacroDataset } from '@/service/NexacroDataset';
import {
  gds_userInfo,
  gds_menu,
  gds_button,
  gds_favorite,
  notifyGlobalDatasetChange,
} from '@/service/globalDataset';
import './LoginPage.less';

export default function LoginPage({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [userPw, setUserPw] = useState('');
  const [saveId, setSaveId] = useState(true);
  const [loading, setLoading] = useState(false);

  const idInputRef = useRef(null);
  const pwInputRef = useRef(null);

  // 1. 폼 초기화 (저장된 아이디 로드 및 포커스 설정)
  useEffect(() => {
    const savedLoginId = localStorage.getItem('sLoginId');
    if (savedLoginId) {
      setUserId(savedLoginId);
      setSaveId(true);
      setTimeout(() => pwInputRef.current?.focus(), 100);
    } else {
      setTimeout(() => idInputRef.current?.focus(), 100);
    }
  }, []);

  // 2. 로그인 트랜잭션 실행
  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    if (!userId.trim()) {
      message.warning('아이디를 입력해 주세요.');
      idInputRef.current?.focus();
      return;
    }

    if (!userPw.trim()) {
      message.warning('비밀번호를 입력해 주세요.');
      pwInputRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const fsp = new FspClient();
      fsp.fsp_clear();

      // ds_login 데이터셋 구성
      const dsColumns = [
        { id: '사용자ID', type: 'string', size: '20' },
        { id: 'SESSION_ID', type: 'STRING', size: '256' },
        { id: '비밀번호', type: 'STRING', size: '256' },
      ];

      const loginDataset = new NexacroDataset('ds_login', dsColumns, [
        {
          사용자ID: userId.trim(),
          SESSION_ID: '',
          비밀번호: userPw.trim(),
        },
      ]);

      // brk-system#SysLoginAction 호출
      const response = await fsp.fsp_callService(
        'brk-system#SysLoginAction',
        'executeLogin',
        { ds_iLogin: loginDataset }
      );

      // 서버 수신 데이터셋 추출
      const resUserInfo = response.ds_oUserInfo || response.gds_userInfo;
      const resMenu = response.ds_oMenu || response.gds_menu;
      const resButton = response.ds_oButton || response.gds_button;
      const resFavorite = response.ds_oFavorite || response.gds_favorite;

      // 전역 글로벌 데이터셋(gds_*)에 저장
      if (resUserInfo) gds_userInfo.loadData(resUserInfo);
      if (resMenu) gds_menu.loadData(resMenu);
      if (resButton) gds_button.loadData(resButton);
      if (resFavorite) gds_favorite.loadData(resFavorite);

      // 전역 리스너 알림 (MdiLayout 등 트리 및 상태바 갱신 트리거)
      notifyGlobalDatasetChange();

      // 아이디 로컬 스토리지 저장 처리
      if (saveId) {
        localStorage.setItem('sLoginId', userId.trim());
      } else {
        localStorage.removeItem('sLoginId');
      }

      const userName =
        gds_userInfo.getColumn(0, '사용자명') ||
        gds_userInfo.getColumn(0, '회사명') ||
        userId;

      message.success(`${userName}님, 환영합니다.`);

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess();
      }
    } catch (error) {
      console.error('로그인 에러:', error);
      message.error(error.message || '로그인 처리에 실패했습니다.');
      pwInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nx-login-wrapper">
      <div className="nx-login-header">
        <h1 className="nx-logo-title">Trust!</h1>
        <p className="nx-sub-title">
          <span>여의도 부동산중개의 일등파트너</span>
          <strong>
            {' '}여의도정프로 <span className="blue-point">부동산중개 시스템</span>에 오신 것을 환영합니다.
          </strong>
        </p>
      </div>

      <div className="nx-login-card">
        {/* 모니터 보안 그래픽 */}
        <div className="nx-visual-box">
          <div className="nx-monitor-mockup">
            <div className="nx-monitor-screen">
              <LockOutlined className="screen-lock-icon" />
            </div>
            <div className="nx-monitor-stand"></div>
            <div className="nx-monitor-base"></div>
          </div>
        </div>

        {/* 로그인 폼 */}
        <form className="nx-form-box" onSubmit={handleLogin}>
          <div className="nx-form-row">
            <label className="nx-label">• 아이디</label>
            <Input
              ref={idInputRef}
              className="nx-input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onPressEnter={() => pwInputRef.current?.focus()}
              placeholder="아이디"
              autoComplete="username"
            />
          </div>

          <div className="nx-form-row">
            <label className="nx-label">• 비밀번호</label>
            <Input.Password
              ref={pwInputRef}
              className="nx-input"
              value={userPw}
              onChange={(e) => setUserPw(e.target.value)}
              onPressEnter={handleLogin}
              placeholder="비밀번호"
              autoComplete="current-password"
            />
          </div>

          <div className="nx-form-row check-row">
            <Checkbox
              checked={saveId}
              onChange={(e) => setSaveId(e.target.checked)}
              className="nx-checkbox"
            >
              아이디저장
            </Checkbox>
          </div>

          {/* 원형 LOGIN 버튼 */}
          <button
            type="submit"
            className="nx-btn-login-round"
            disabled={loading}
          >
            {loading ? '...' : 'LOGIN'}
          </button>
        </form>
      </div>
    </div>
  );
}