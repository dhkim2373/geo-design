// src/pages/home/mainDashboard.jsx
import React from 'react';
import { Button, Input, DatePicker, Checkbox, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import './mainDashboard.less';

export default function MainDashboard() {
  return (
    <div className="nx-main-dashboard">
      {/* 1. 상단 공통 검색/기능 툴바 */}
      <div className="nx-dash-toolbar">
        <Button size="small" type="primary" className="nx-action-btn">조회</Button>
        <div className="nx-filter-group">
          <span className="filter-label">게시일자</span>
          <DatePicker size="small" style={{ width: 110 }} />
          <span style={{ margin: '0 4px' }}>-</span>
          <DatePicker size="small" style={{ width: 110 }} />

          <span className="filter-label" style={{ marginLeft: 16 }}>제목</span>
          <Input size="small" style={{ width: 220 }} />

          <Checkbox style={{ marginLeft: 12, fontSize: 12 }}>신규</Checkbox>
        </div>
      </div>

      {/* 2. 본문 2분할 넥사크로 폼 영역 */}
      <div className="nx-dash-body">
        {/* 좌측 공지사항 그리드 헤더 및 빈 목록 */}
        <div className="nx-grid-panel">
          <div className="nx-grid-header">
            <div className="col-cell w-date">공지일자</div>
            <div className="col-cell w-title">제목</div>
          </div>
          <div className="nx-grid-content">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터가 없습니다." />
          </div>
        </div>

        {/* 우측 공지사항 상세 상세정보 폼 */}
        <div className="nx-detail-panel">
          <div className="nx-form-table">
            <div className="nx-tr">
              <div className="nx-th">공지번호</div>
              <div className="nx-td"><Input size="small" disabled style={{ width: 100 }} /></div>
              <div className="nx-th">작성자</div>
              <div className="nx-td"><Input size="small" disabled style={{ width: 90 }} /></div>
              <div className="nx-th">등록일자</div>
              <div className="nx-td"><Input size="small" disabled style={{ width: 120 }} /></div>
            </div>
            <div className="nx-tr">
              <div className="nx-th">등록일자</div>
              <div className="nx-td"><DatePicker size="small" style={{ width: 110 }} /></div>
              <div className="nx-th">팝업종료일자</div>
              <div className="nx-td"><DatePicker size="small" style={{ width: 110 }} /></div>
              <div className="nx-td colspan" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Checkbox style={{ fontSize: 12 }}>공지강조</Checkbox>
                <Checkbox style={{ fontSize: 12 }}>팝업여부</Checkbox>
              </div>
            </div>
            <div className="nx-tr">
              <div className="nx-th">제목</div>
              <div className="nx-td full"><Input size="small" /></div>
            </div>
          </div>

          <div className="nx-detail-content">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="데이터가 없습니다." />
          </div>
        </div>
      </div>
    </div>
  );
}