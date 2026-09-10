// src/layouts/MdiLayout.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Tabs, Input, Button, Space, Tooltip } from 'antd';
import {
  SearchOutlined,
  HomeOutlined,
  CloseOutlined,
  StarOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  UserOutlined,
  DesktopOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { gds_userInfo, gds_menu, subscribeGlobalDataset } from '@/service/globalDataset';
import LoginPage from '@/pages/Login/LoginPage';
import MainDashboard from '@/pages/Home/MainDashboard';
import { getComponentByMenu } from '@/routes/pageRegistry';
import './MdiLayout.less';

const { Header, Sider, Content, Footer } = Layout;

export default function MdiLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tabs, setTabs] = useState([]);
  const [activeKey, setActiveKey] = useState('HOME');
  const [currentTime, setCurrentTime] = useState('');
  const [menuSearchText, setMenuSearchText] = useState('');
  const [, setForceUpdate] = useState({});

  // 글로벌 데이터셋 갱신 리스너 등록
  useEffect(() => {
    return subscribeGlobalDataset(() => {
      setForceUpdate({});
    });
  }, []);

  // 시계 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      setCurrentTime(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. ds_oMenu 데이터셋 구조 기반 Ant Design 트리 메뉴 생성
  const menuItems = useMemo(() => {
    const rows = gds_menu.rows || [];
    if (rows.length === 0) return [];

    // 메뉴 정렬: MENU_ORDER 또는 MENU_SORT 기준
    const sortedRows = [...rows].sort((a, b) =>
      String(a.MENU_ORDER || '').localeCompare(String(b.MENU_ORDER || ''))
    );

    const rootNodes = [];
    const childMap = {};

    sortedRows.forEach((row) => {
      // 검색어가 있으면 필터링
      if (
        menuSearchText &&
        !String(row.MENU_LABEL || '').includes(menuSearchText) &&
        !String(row.MENU_ID || '').includes(menuSearchText)
      ) {
        return;
      }

      const isRoot = row.MENU_PARENT === 'root_menu' || !row.MENU_PARENT;
      const node = {
        key: row.MENU_ID,
        label: row.MENU_LABEL, // 한글 메뉴명 매핑
        icon: isRoot ? <FolderOpenOutlined /> : <FileTextOutlined />,
        raw: row,
      };

      if (isRoot) {
        rootNodes.push(node);
      } else {
        if (!childMap[row.MENU_PARENT]) {
          childMap[row.MENU_PARENT] = [];
        }
        childMap[row.MENU_PARENT].push(node);
      }
    });

    // 루트 폴더 아래에 자식 메뉴(MENU) 결합
    return rootNodes.map((parent) => {
      const children = childMap[parent.key];
      if (children && children.length > 0) {
        return { ...parent, children };
      }
      return parent;
    });
  }, [gds_menu.rows, menuSearchText]);

  // 2. 메뉴 클릭 시 탭 열기
  const handleMenuClick = ({ key }) => {
    const foundRow = gds_menu.rows.find((r) => r.MENU_ID === key);
    if (!foundRow) return;

    // 대메뉴(POPUP/폴더) 클릭은 무시
    if (foundRow.MENU_TYPE === 'POPUP' && foundRow.MENU_PARENT === 'root_menu') {
      return;
    }

    const Comp = getComponentByMenu(foundRow);

    setTabs((prev) => {
      if (prev.some((tab) => tab.key === key)) return prev;
      return [
        ...prev,
        {
          key,
          title: foundRow.MENU_LABEL,
          menuRow: foundRow,
          Component: Comp,
          closable: true,
        },
      ];
    });

    setActiveKey(key);
  };

  const closeTab = (targetKey) => {
    setTabs((prev) => {
      const filtered = prev.filter((tab) => tab.key !== targetKey);
      if (activeKey === targetKey) {
        setActiveKey(filtered.length > 0 ? filtered[filtered.length - 1].key : 'HOME');
      }
      return filtered;
    });
  };

  const closeAllTabs = () => {
    setTabs([]);
    setActiveKey('HOME');
  };

  const handleLogout = () => {
    gds_userInfo.clearData();
    gds_menu.clearData();
    setIsLoggedIn(false);
    setTabs([]);
    setActiveKey('HOME');
  };

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  // 사용자 정보 바인딩
  const currentUserId = gds_userInfo?.getColumn?.(0, '사용자ID') || 'REDBOMBZ';
  const currentUserName =
    gds_userInfo?.getColumn?.(0, '회사명') ||
    gds_userInfo?.getColumn?.(0, '사용자명') ||
    '테스트부동산';

  return (
    <Layout className="mdi-main-layout">
      {/* 상단 탭 바 */}
      <Header className="mdi-top-header">
        <div className="mdi-header-left">
          <Button
            type="text"
            icon={<HomeOutlined />}
            className={`mdi-home-btn ${activeKey === 'HOME' ? 'active' : ''}`}
            onClick={() => setActiveKey('HOME')}
          />
          <Tabs
            type="editable-card"
            hideAdd
            activeKey={activeKey}
            onChange={setActiveKey}
            onEdit={(targetKey, action) => {
              if (action === 'remove') closeTab(targetKey);
            }}
            items={tabs.map((tab) => ({
              key: tab.key,
              label: tab.title,
              closable: tab.closable,
            }))}
            className="mdi-tab-bar"
          />
        </div>
        <div className="mdi-header-right">
          <Space size={6}>
            <Tooltip title="도움말"><Button type="text" icon={<QuestionCircleOutlined />} /></Tooltip>
            <Tooltip title="즐겨찾기"><Button type="text" icon={<StarOutlined />} /></Tooltip>
            <Tooltip title="모두 닫기"><Button type="text" icon={<CloseOutlined />} onClick={closeAllTabs} /></Tooltip>
          </Space>
        </div>
      </Header>

      <Layout className="mdi-body-layout">
        {/* 좌측 동적 트리 메뉴 */}
        <Sider width={220} className="mdi-sider-panel">
          <div className="mdi-menu-search">
            <Input
              placeholder="메뉴검색"
              value={menuSearchText}
              onChange={(e) => setMenuSearchText(e.target.value)}
              suffix={<SearchOutlined style={{ color: '#1890ff' }} />}
              size="small"
              allowClear
            />
          </div>
          <div className="mdi-tree-menu-container">
            <Menu
              mode="inline"
              defaultOpenKeys={['S0000', 'C0000', 'D0000', 'A9000']}
              selectedKeys={[activeKey]}
              onClick={handleMenuClick}
              items={menuItems}
              className="mdi-side-menu"
            />
          </div>
          <div className="mdi-sider-bottom-tools">
            <Button type="text" size="small" icon={<StarOutlined />}>즐겨찾기</Button>
            <Button type="text" size="small" icon={<DesktopOutlined />}>최근메뉴</Button>
            <Button type="text" size="small" icon={<SettingOutlined />}>설정</Button>
          </div>
        </Sider>

        {/* 메인 뷰포트 (열린 탭 캐싱 유지) */}
        <Content className="mdi-content-viewport">
          <div
            className="mdi-page-container"
            style={{ display: activeKey === 'HOME' ? 'block' : 'none' }}
          >
            <MainDashboard />
          </div>

          {tabs.map((tab) => {
            const Component = tab.Component;
            return (
              <div
                key={tab.key}
                className="mdi-page-container"
                style={{ display: activeKey === tab.key ? 'block' : 'none' }}
              >
                <Component />
              </div>
            );
          })}
        </Content>
      </Layout>

      {/* 하단 넥사크로 상태바 */}
      <Footer className="mdi-status-bar">
        <div className="mdi-status-left">
          <span className="status-item blue-text">0건 조회되었습니다.</span>
        </div>
        <div className="mdi-status-right">
          <span className="status-item">화면ID : {activeKey === 'HOME' ? '' : activeKey}</span>
          <span className="status-divider">|</span>
          <span className="status-item">{currentTime}</span>
          <span className="status-divider">|</span>
          <span className="status-item">
            <UserOutlined /> {currentUserName} / <strong>{currentUserId}</strong>
          </span>
          <span className="status-divider">|</span>
          <a className="status-logout" onClick={handleLogout}>로그아웃</a>
        </div>
      </Footer>
    </Layout>
  );
}