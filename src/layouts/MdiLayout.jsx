// src/layouts/mdiLayout.jsx
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
import LoginPage from '@/pages/login/loginPage';
import MainDashboard from '@/pages/home/mainDashboard';
import { getComponentByMenu } from '@/routes/pageRegistry';
import './mdiLayout.less';

const { Header, Sider, Content, Footer } = Layout;

// 3depth 이상을 지원하는 재귀 메뉴 트리 빌더 함수
const buildRecursiveMenuTree = (rows, parentId, searchText) => {
  const branch = [];

  rows.forEach((row) => {
    // 넥사크로 컬럼 규격 매핑 (상위메뉴ID / UPPER_MENU_ID / MENU_PARENT)
    const currentParentId = String(
      row.UPPER_MENU_ID ?? row.상위메뉴ID ?? row.MENU_PARENT ?? '0'
    );
    const menuId = String(row.MENU_ID ?? row.메뉴ID ?? row.화면ID ?? '');
    const menuLabel = row.MENU_NM ?? row.메뉴명 ?? row.화면명 ?? row.MENU_LABEL ?? '';

    if (currentParentId === String(parentId)) {
      // 하위 노드 재귀 탐색
      const children = buildRecursiveMenuTree(rows, menuId, searchText);
      const isLeaf = children.length === 0;

      // 검색어 필터링 판별: 본인이 매칭되거나 하위 자식 중 매칭되는 것이 있는 경우 포함
      const isSelfMatch =
        !searchText ||
        menuLabel.toLowerCase().includes(searchText.toLowerCase()) ||
        menuId.toLowerCase().includes(searchText.toLowerCase());

      if (isSelfMatch || !isLeaf) {
        branch.push({
          key: menuId,
          label: menuLabel,
          icon: isLeaf ? (
            <FileTextOutlined style={{ fontSize: 13 }} />
          ) : (
            <FolderOpenOutlined style={{ fontSize: 13, color: '#1890ff' }} />
          ),
          children: isLeaf ? undefined : children,
          raw: row,
        });
      }
    }
  });

  return branch;
};

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

  // 1. gds_menu 데이터셋 기반 3depth 재귀 트리 메뉴 생성
  const menuItems = useMemo(() => {
    const rows = gds_menu.rows || [];
    if (rows.length === 0) return [];

    // 메뉴 정렬: MENU_ORDER, MENU_SORT, 정렬순서 기준
    const sortedRows = [...rows].sort((a, b) => {
      const orderA = a.MENU_ORDER ?? a.MENU_SORT ?? a.정렬순서 ?? 0;
      const orderB = b.MENU_ORDER ?? b.MENU_SORT ?? b.정렬순서 ?? 0;
      return String(orderA).localeCompare(String(orderB), undefined, { numeric: true });
    });

    // 최상위 parentId 판별 ('0', 'root_menu', null, 빈값 등 포괄 대응)
    const firstRowParent = sortedRows[0]?.UPPER_MENU_ID ?? sortedRows[0]?.MENU_PARENT ?? '0';
    const rootId = sortedRows.some((r) => (r.UPPER_MENU_ID ?? r.MENU_PARENT) === '0')
      ? '0'
      : firstRowParent;

    return buildRecursiveMenuTree(sortedRows, rootId, menuSearchText.trim());
  }, [gds_menu.rows, menuSearchText]);

  // 2. 메뉴 클릭 시 탭 열기 (하위 폴더 클릭은 무시)
  const handleMenuClick = ({ key, item }) => {
    const foundRow =
      item?.props?.raw ||
      gds_menu.rows?.find((r) => String(r.MENU_ID ?? r.메뉴ID ?? r.화면ID) === String(key));

    if (!foundRow) return;

    // 하위 자식이 있는 폴더 메뉴인 경우 탭 오픈 생략
    const isFolder = gds_menu.rows?.some((r) => {
      const parentId = String(r.UPPER_MENU_ID ?? r.상위메뉴ID ?? r.MENU_PARENT ?? '');
      return parentId === String(key);
    });
    if (isFolder) return;

    const menuLabel = foundRow.MENU_NM ?? foundRow.메뉴명 ?? foundRow.화면명 ?? foundRow.MENU_LABEL;
    const Comp = getComponentByMenu(foundRow);

    setTabs((prev) => {
      if (prev.some((tab) => tab.key === key)) return prev;
      return [
        ...prev,
        {
          key,
          title: menuLabel,
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
            <Tooltip title="도움말">
              <Button type="text" icon={<QuestionCircleOutlined />} />
            </Tooltip>
            <Tooltip title="즐겨찾기">
              <Button type="text" icon={<StarOutlined />} />
            </Tooltip>
            <Tooltip title="모두 닫기">
              <Button type="text" icon={<CloseOutlined />} onClick={closeAllTabs} />
            </Tooltip>
          </Space>
        </div>
      </Header>

      <Layout className="mdi-body-layout">
        {/* 좌측 사이드바: 고정 검색창 + 전용 스크롤 메뉴 트리 + 하단 툴 */}
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
              inlineIndent={14}
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

      {/* 하단 상태바 */}
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