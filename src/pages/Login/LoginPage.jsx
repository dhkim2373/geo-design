// src/pages/Login/LoginPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Input, Checkbox, Button, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { FspClient } from '@/service/FspClient';
import { NexacroDataset } from '@/service/NexacroDataset';
import {
  gds_allCompany,
  gds_userInfo,
  gds_menu,
  gds_button,
  gds_message,
  gds_favorite,
  gds_grpQueryCond,
  gds_authCompany,
  gds_authStore,
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

  // 1. 폼 초기화 (저장된 아이디 로드 및 포커스)
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

  // 2. 로그인 성공 후처리
  const handleAfterLogin = (currUserId) => {
    if (saveId) {
      localStorage.setItem('sLoginId', currUserId);
    } else {
      localStorage.removeItem('sLoginId');
    }

    // MdiLayout 및 하위 컴포넌트 렌더링 동기화
    notifyGlobalDatasetChange();

    const userName =
      gds_userInfo.getColumn(0, '사용자명') ||
      gds_userInfo.getColumn(0, 'USER_NAME') ||
      currUserId;

    message.success(`${userName}님, 환영합니다.`);

    if (typeof onLoginSuccess === 'function') {
      onLoginSuccess();
    }
  };

  // 3. 로그인 트랜잭션 실행
  const handleLogin = async (e) => {
    if (e) e.preventDefault();

    const trimmedId = userId.trim();
    const trimmedPw = userPw.trim();

    if (!trimmedId) {
      message.warning('아이디를 입력해 주세요.');
      idInputRef.current?.focus();
      return;
    }

    if (!trimmedPw) {
      message.warning('비밀번호를 입력해 주세요.');
      pwInputRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const fsp = new FspClient();
      fsp.fsp_clear();

      // ds_login 데이터셋 생성
      const dsColumns = [
        { id: '사용자ID', type: 'string', size: '20' },
        { id: 'SESSION_ID', type: 'STRING', size: '256' },
        { id: '비밀번호', type: 'STRING', size: '256' },
      ];

      const loginDataset = new NexacroDataset('ds_login', dsColumns, [
        {
          사용자ID: trimmedId,
          SESSION_ID: '',
          비밀번호: trimmedPw,
        },
      ]);

      // tpl-system#SysLoginAction 실행 (9대 아웃풋 데이터셋 요청)[cite: 1]
      const response = await fsp.fsp_callService(
        'tpl-system#SysLoginAction',
        'executeLogin',
        { ds_iLogin: loginDataset }
      );

      // 응답 데이터셋 추출 헬퍼 함수 (ds_o* 또는 gds_* 명칭 포괄 대응)
      const extractDs = (targetDsName, outDsName) => {
        return (
          response[outDsName] ||
          response[targetDsName] ||
          response?.datasets?.[outDsName] ||
          response?.datasets?.[targetDsName]
        );
      };

      // FDL 9개 전역 데이터셋 바인딩[cite: 1]
      // gds_allCompany=ds_oAllCompany[cite: 1]
      const resAllCompany = extractDs('gds_allCompany', 'ds_oAllCompany');
      if (resAllCompany) gds_allCompany.loadData(resAllCompany);

      // gds_userInfo=ds_oUserInfo[cite: 1]
      const resUserInfo = extractDs('gds_userInfo', 'ds_oUserInfo');
      if (resUserInfo) gds_userInfo.loadData(resUserInfo);

      // gds_menu=ds_oMenu[cite: 1]
      const resMenu = extractDs('gds_menu', 'ds_oMenu');
      if (resMenu) gds_menu.loadData(resMenu);

      // gds_button=ds_oButton[cite: 1]
      const resButton = extractDs('gds_button', 'ds_oButton');
      if (resButton) gds_button.loadData(resButton);

      // gds_message=ds_oMessage[cite: 1]
      const resMessage = extractDs('gds_message', 'ds_oMessage');
      if (resMessage) gds_message.loadData(resMessage);

      // gds_favorite=ds_oFavorite[cite: 1]
      const resFavorite = extractDs('gds_favorite', 'ds_oFavorite');
      if (resFavorite) gds_favorite.loadData(resFavorite);

      // gds_grpQueryCond=ds_oGrpQueryCond[cite: 1]
      const resGrpQueryCond = extractDs('gds_grpQueryCond', 'ds_oGrpQueryCond');
      if (resGrpQueryCond) gds_grpQueryCond.loadData(resGrpQueryCond);

      // gds_authCompany=ds_oAuthCompany[cite: 1]
      const resAuthCompany = extractDs('gds_authCompany', 'ds_oAuthCompany');
      if (resAuthCompany) gds_authCompany.loadData(resAuthCompany);

      // gds_authStore=ds_oAuthStore[cite: 1]
      const resAuthStore = extractDs('gds_authStore', 'ds_oAuthStore');
      if (resAuthStore) gds_authStore.loadData(resAuthStore);

      const recUserId = gds_userInfo.getColumn(0, '사용자ID') || trimmedId;
      handleAfterLogin(recUserId);
    } catch (error) {
      console.error('로그인 에러:', error);
      message.error(error.message || '로그인 처리에 실패했습니다.');
      pwInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tpl-login-wrapper">
      <div className="tpl-login-container">
        {/* 상단 타이틀 영역[cite: 1] */}
        <div className="tpl-top-title-area">
          <div className="tpl-sub-text">의약, 건강, 유통의 일등파트너</div>
          <div className="tpl-main-welcome">
            <span className="brand-point">지오영</span> TPL 시스템에{' '}
            <span className="brand-point">오신 것을 환영</span> 합니다.{' '}
            <span className="version-tag">[V2.1]</span>
          </div>
        </div>

        {/* 중앙 카드 박스 (715x220)[cite: 1] */}
        <div className="tpl-login-box">
          {/* 좌측 그래픽 (sta_ImgLeft)[cite: 1] */}
          <div className="tpl-left-visual">
            <div className="visual-circle">
              <LockOutlined className="visual-icon" />
            </div>
            <div className="visual-label">SECURITY LOGIN</div>
          </div>

          {/* 우측 입력 폼 영역 */}
          <form className="tpl-form-area" onSubmit={handleLogin}>
            <div className="tpl-inputs-wrapper">
              <div className="tpl-input-row">
                <span className="tpl-input-label">아이디</span>
                <Input
                  ref={idInputRef}
                  className="tpl-input"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  onPressEnter={() => pwInputRef.current?.focus()}
                  placeholder="아이디"
                  autoComplete="username"
                />
              </div>

              <div className="tpl-input-row">
                <span className="tpl-input-label">비밀번호</span>
                <Input.Password
                  ref={pwInputRef}
                  className="tpl-input"
                  value={userPw}
                  onChange={(e) => setUserPw(e.target.value)}
                  onPressEnter={handleLogin}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* 정사각형 로그인 버튼 (83x83)[cite: 1] */}
            <button
              type="submit"
              className="tpl-btn-login"
              disabled={loading}
            >
              {loading ? '...' : 'LOGIN'}
            </button>

            {/* 하단 옵션 툴바[cite: 1] */}
            <div className="tpl-bottom-tools">
              <Checkbox
                checked={saveId}
                onChange={(e) => setSaveId(e.target.checked)}
                className="tpl-checkbox"
              >
                아이디저장
              </Checkbox>

              <div className="tpl-btn-group">
                <Button
                  type="default"
                  size="small"
                  className="tpl-sub-btn"
                  onClick={() => message.info('관리자에게 문의하세요.')}
                >
                  비밀번호 찾기
                </Button>
                <Button
                  type="default"
                  size="small"
                  className="tpl-sub-btn"
                  onClick={() => window.open('http://helpu.kr', '_blank')}
                >
                  원격지원
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}