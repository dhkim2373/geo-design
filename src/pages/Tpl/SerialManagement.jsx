import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Form, Input, Select, Button, Modal, Space, Tag, message } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  BarcodeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { DataEditor, GridCellKind, CompactSelection } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';

import { FspClient } from '@/service/fspClient';
import { NexacroDataset } from '@/service/nexacroDataset';
import { gds_authCompany } from '@/service/globalDataset';
import './serialManagement.less';

const { Option } = Select;

const GRID_COLUMNS = [
  { id: 'no', title: 'NO', width: 55 },
  { id: '표준코드', title: '표준코드', width: 110 },
  { id: '로트번호', title: '로트번호', width: 100 },
  { id: '유통기한', title: '유통기한', width: 95 },
  { id: '일련번호', title: '일련번호', width: 160 },
  { id: '일련번호상태명', title: '상태', width: 85 },
  { id: 'AGG1차', title: 'AGG1차', width: 140 },
  { id: 'AGG2차', title: 'AGG2차', width: 140 },
  { id: 'AGG3차', title: 'AGG3차', width: 140 },
  { id: 'AGG4차', title: 'AGG4차', width: 140 },
  { id: '처리일자', title: '생성일자', width: 100 },
  { id: '입고확정번호', title: '입고확정번호', width: 120 },
  { id: '삭제', title: '삭제', width: 75 },
];

const THEMES = {
  focused: { bgCell: '#d8eaff' },
  noDefault: { bgCell: '#fafbfc' },
  outState: { bgCell: '#f0f7ff', textDark: '#1890ff' },
  defaultState: { bgCell: '#ffffff', textDark: '#222222' },
  canDel: { bgCell: '#fff1f0', textDark: '#ff4d4f' },
  cannotDel: { bgCell: '#fafafa', textDark: '#888888' },
  cellDefault: { bgCell: '#ffffff' },
};

export default function SerialManagement() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [rowCount, setRowCount] = useState(0);
  const [gridKey, setGridKey] = useState(0);
  const [companyList, setCompanyList] = useState([]);
  const [gridHeight, setGridHeight] = useState(500);

  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [selectedColIndex, setSelectedColIndex] = useState(null);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailList, setDetailList] = useState([]);

  const containerRef = useRef(null);
  const tableWrapperRef = useRef(null);

  // 60만 건 배열 및 동적 컬럼 인덱스 맵 보관
  const rawDataRef = useRef([]);
  const colIndexMapRef = useRef({});
  const renderRafRef = useRef(null);

  useEffect(() => {
    return () => {
      if (renderRafRef.current) {
        cancelAnimationFrame(renderRafRef.current);
      }
      if (rawDataRef.current) {
        rawDataRef.current.length = 0;
        rawDataRef.current = null;
      }
    };
  }, []);

  const calculateHeight = useCallback(() => {
    if (!tableWrapperRef.current) return;
    const rect = tableWrapperRef.current.getBoundingClientRect();
    const statusBarHeight = 25;
    const bottomPadding = 8;
    const available = window.innerHeight - rect.top - statusBarHeight - bottomPadding;
    if (available > 150) {
      setGridHeight(Math.floor(available));
    }
  }, []);

  useEffect(() => {
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    const t = setTimeout(calculateHeight, 100);
    return () => {
      window.removeEventListener('resize', calculateHeight);
      clearTimeout(t);
    };
  }, [calculateHeight]);

  useEffect(() => {
    const authRows = gds_authCompany?.rows || [];
    if (authRows.length > 0) {
      const mapped = authRows.map((r) => ({
        코드: r.회사코드 || r.COMPANY_CD,
        명칭: r.회사명 || r.COMPANY_NM,
      }));
      setCompanyList(mapped);
      form.setFieldsValue({ 회사코드: mapped[0]?.코드 || '' });
    }
  }, [form]);

  const handleSearch = async () => {
    let fsp = null;
    try {
      const values = await form.validateFields();
      const { 회사코드, 제품코드, 로트번호, 일련번호, AGG번호 } = values;

      if (!회사코드 && !제품코드) {
        message.warning('제품코드를 입력하세요.');
        return;
      }

      if (rawDataRef.current) {
        rawDataRef.current.length = 0;
        rawDataRef.current = null;
      }
      colIndexMapRef.current = {};
      setRowCount(0);
      setGridKey((prev) => prev + 1);

      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 120);
        });
      });
      rawDataRef.current = [];

      setLoading(true);

      fsp = new FspClient();
      fsp.fsp_clear();
      fsp.fsp_setBiz('nTplBiz');
      fsp.fsp_addCSVSearch('tpl/tpl/retrieve:tpl_일련번호_조회_s01', 100);

      const searchDataset = new NexacroDataset(
        'ds_search',
        [
          { id: '회사코드', type: 'string', size: '256' },
          { id: '제품코드', type: 'string', size: '256' },
          { id: '로트번호', type: 'string', size: '256' },
          { id: '일련번호', type: 'string', size: '256' },
          { id: 'AGG번호', type: 'string', size: '256' },
        ],
        [{
          회사코드: 회사코드 || '',
          제품코드: 제품코드 || '',
          로트번호: 로트번호 || '',
          일련번호: 일련번호 || '',
          AGG번호: AGG번호 || '',
        }]
      );

      await fsp.fsp_callServiceStream(
        '',
        '',
        { ds_iList: searchDataset },
        '',
        (currentRows, isFirst, isDone, columns) => {
          if (columns && columns.length > 0) {
            const map = {};
            columns.forEach((colName, idx) => {
              map[colName] = idx;
            });
            colIndexMapRef.current = map;
          }

          if (renderRafRef.current) {
            cancelAnimationFrame(renderRafRef.current);
          }

          renderRafRef.current = requestAnimationFrame(() => {
            rawDataRef.current = currentRows;
            setRowCount(currentRows.length);

            if (isFirst) {
              setSelectedRowIndex(0);
              setSelectedColIndex(1);
              message.loading({
                content: '초기 100건 수신 완료. 전체 데이터 수신 중...',
                key: 'streamMsg',
                duration: 0,
              });
            }

            if (isDone) {
              setLoading(false);
              message.success({
                content: `조회 완료 (총 ${currentRows.length.toLocaleString()}건)`,
                key: 'streamMsg',
                duration: 3,
              });
            }
          });
        }
      );
    } catch (err) {
      console.error('조회 통신 에러:', err);
      message.error({ content: '조회 중 오류가 발생했습니다.', key: 'streamMsg' });
      setLoading(false);
    } finally {
      if (fsp) {
        fsp.destroy();
      }
    }
  };

  const handleReset = () => {
    form.resetFields();
    if (companyList.length > 0) {
      form.setFieldsValue({ 회사코드: companyList[0].코드 });
    }

    if (rawDataRef.current) {
      rawDataRef.current.length = 0;
      rawDataRef.current = [];
    }
    colIndexMapRef.current = {};
    setRowCount(0);
    setGridKey((prev) => prev + 1);
    setSelectedRowIndex(null);
    setSelectedColIndex(null);
    message.destroy('streamMsg');
  };

  const handleOpenDetailModal = async (rowArr) => {
    setDetailModalVisible(true);
    setDetailLoading(true);
    setDetailList([]);

    const map = colIndexMapRef.current;
    const record = {
      회사코드: rowArr[map['회사코드']] || form.getFieldValue('회사코드'),
      표준코드: rowArr[map['표준코드']],
      로트번호: rowArr[map['로트번호']],
      일련번호: rowArr[map['일련번호']],
    };

    let fsp = null;
    try {
      fsp = new FspClient();
      fsp.fsp_clear();
      fsp.fsp_setBiz('nTplBiz');
      fsp.fsp_addSearch('tpl/tpl/retrieve:tpl_일련번호_조회_s02', false);

      const paramDs = new NexacroDataset(
        'ds_search',
        [
          { id: '회사코드', type: 'string', size: '256' },
          { id: '표준코드', type: 'string', size: '256' },
          { id: '로트번호', type: 'string', size: '256' },
          { id: '일련번호', type: 'string', size: '256' },
        ],
        [{
          회사코드: record.회사코드 || '',
          표준코드: record.표준코드 || '',
          로트번호: record.로트번호 || '',
          일련번호: record.일련번호 || '',
        }]
      );

      const response = await fsp.fsp_callService('', '', { ds_iList: paramDs });
      const ds = response?.ds_oList || response?.ds_list || response?.datasets?.ds_oList;

      let list = [];
      if (ds instanceof NexacroDataset) list = ds.rows;
      else if (Array.isArray(ds)) list = ds;
      else if (ds?.rows) list = ds.rows;

      setDetailList(list);
    } catch (err) {
      console.error('상세 팝업 조회 에러:', err);
      message.error('상세 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
      if (fsp) fsp.destroy();
    }
  };

  const handleDeleteRow = (rowArr) => {
    const map = colIndexMapRef.current;
    const delYn = rowArr[map['삭제가능여부']];
    if (String(delYn) !== '1') return;

    const stdCode = rowArr[map['표준코드']];
    const serialNo = rowArr[map['일련번호']];
    const compCode = rowArr[map['회사코드']] || form.getFieldValue('회사코드');

    Modal.confirm({
      title: '일련번호 삭제 확인',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: `해당 일련번호(${serialNo})를 삭제하시겠습니까?`,
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        let fsp = null;
        try {
          fsp = new FspClient();
          fsp.fsp_clear();
          fsp.fsp_addSearch('tpl/tpl/retrieve:tpl_일련번호_일련번호삭제_s01', false);

          const condDataset = new NexacroDataset(
            'ds_cond',
            [
              { id: '회사코드', type: 'string', size: '256' },
              { id: '표준코드', type: 'string', size: '256' },
              { id: '일련번호', type: 'string', size: '256' },
            ],
            [{
              회사코드: compCode,
              표준코드: stdCode,
              일련번호: serialNo,
            }]
          );

          await fsp.fsp_callService('', '', { ds_iList: condDataset });
          message.success('삭제가 완료되었습니다.');
          handleSearch();
        } catch (err) {
          console.error('삭제 처리 에러:', err);
          message.error('삭제 중 오류가 발생했습니다.');
        } finally {
          if (fsp) fsp.destroy();
        }
      },
    });
  };

  const handleBarcodeEnter = (e) => {
    const rawCode = e.target.value.trim();
    if (!rawCode) return;

    if (rawCode.startsWith('00') || (rawCode.startsWith('01') && !rawCode.startsWith('010'))) {
      const pureAgg = rawCode.replace(/FNC1/g, '');
      form.setFieldsValue({
        제품코드: '',
        제품코드2: '',
        제품명: '',
        로트번호: '',
        일련번호: '',
        AGG번호: pureAgg,
      });
      setTimeout(handleSearch, 50);
    } else {
      form.setFieldsValue({ AGG번호: '', 일련번호: rawCode });
      setTimeout(handleSearch, 50);
    }
  };

  // [메모리 최적화] 배열 인덱스 매핑을 통한 고속 셀 데이터 렌더링
  const getCellContent = useCallback(
    ([colIdx, rowIdx]) => {
      const list = rawDataRef.current;
      if (!list || !list[rowIdx]) {
        return { kind: GridCellKind.Loading, allowOverlay: false };
      }

      const row = list[rowIdx];
      const colDef = GRID_COLUMNS[colIdx];
      const map = colIndexMapRef.current;
      const isFocusedCell = rowIdx === selectedRowIndex && colIdx === selectedColIndex;

      if (colDef.id === 'no') {
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          readonly: true,
          displayData: String(rowIdx + 1),
          data: String(rowIdx + 1),
          contentAlign: 'center',
          themeOverride: isFocusedCell ? THEMES.focused : THEMES.noDefault,
        };
      }

      if (colDef.id === '일련번호상태명') {
        const valIdx = map['일련번호상태명'];
        const val = valIdx !== undefined ? row[valIdx] : '';
        const isOut = val === '출고';
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          readonly: true,
          displayData: val || '-',
          data: val,
          contentAlign: 'center',
          themeOverride: isFocusedCell ? THEMES.focused : (isOut ? THEMES.outState : THEMES.defaultState),
        };
      }

      if (colDef.id === '삭제') {
        const valIdx = map['삭제가능여부'];
        const canDel = valIdx !== undefined && String(row[valIdx]) === '1';
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          readonly: true,
          displayData: canDel ? '삭제' : '',
          data: canDel ? '삭제' : '',
          contentAlign: 'center',
          themeOverride: isFocusedCell ? THEMES.focused : (canDel ? THEMES.canDel : THEMES.cannotDel),
        };
      }

      const valIdx = map[colDef.id];
      const rawVal = valIdx !== undefined ? row[valIdx] : '';
      const displayStr = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
      const isCenter = colDef.id === '유통기한' || colDef.id === '처리일자';

      return {
        kind: GridCellKind.Text,
        allowOverlay: true,
        readonly: true,
        displayData: displayStr,
        data: displayStr,
        contentAlign: isCenter ? 'center' : 'left',
        themeOverride: isFocusedCell ? THEMES.focused : THEMES.cellDefault,
      };
    },
    [selectedRowIndex, selectedColIndex]
  );

  const handleCellClicked = useCallback(
    ([colIdx, rowIdx]) => {
      const list = rawDataRef.current;
      if (!list || !list[rowIdx]) return;
      const row = list[rowIdx];
      const map = colIndexMapRef.current;

      setSelectedRowIndex(rowIdx);
      setSelectedColIndex(colIdx);

      const colDef = GRID_COLUMNS[colIdx];
      const stateIdx = map['일련번호상태명'];
      const statusVal = stateIdx !== undefined ? row[stateIdx] : '';

      if (colDef.id === '일련번호상태명' && statusVal === '출고') {
        handleOpenDetailModal(row);
      } else if (colDef.id === '삭제') {
        handleDeleteRow(row);
      }
    },
    []
  );

  const handleGridSelectionChange = useCallback((newSelection) => {
    if (newSelection?.current?.cell) {
      const [col, row] = newSelection.current.cell;
      setSelectedColIndex(col);
      setSelectedRowIndex(row);
    }
  }, []);

  const gridSelection = useMemo(() => {
    if (selectedRowIndex === null) {
      return {
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
        current: undefined,
      };
    }

    const c = selectedColIndex !== null ? selectedColIndex : 1;
    const r = selectedRowIndex;

    return {
      columns: CompactSelection.empty(),
      rows: CompactSelection.empty(),
      current: {
        cell: [c, r],
        range: { x: 0, y: r, width: GRID_COLUMNS.length, height: 1 },
        rangeStack: [],
      },
    };
  }, [selectedRowIndex, selectedColIndex]);

  return (
    <div className="serial-mgmt-container" ref={containerRef}>
      <div className="serial-toolbar">
        <Space size={6}>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
          >
            조회
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            초기화
          </Button>
        </Space>
        <div className="serial-toolbar-right">
          <Tag color="#87d068" className="barcode-badge">
            <BarcodeOutlined /> 바코드 활성
          </Tag>
        </div>
      </div>

      <div className="serial-search-box">
        <Form form={form} layout="inline" className="serial-form">
          <div className="form-row">
            <div className="form-col">
              <span className="field-label">회사</span>
              <Form.Item name="회사코드" noStyle>
                <Select style={{ width: 180 }} size="small">
                  {companyList.map((c) => (
                    <Option key={c.코드} value={c.코드}>
                      {c.명칭}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div className="form-col">
              <span className="field-label compulsory">제품</span>
              <Space.Compact size="small">
                <Form.Item name="제품코드" noStyle>
                  <Input style={{ width: 75 }} placeholder="코드" />
                </Form.Item>
                <Form.Item name="제품코드2" noStyle>
                  <Input style={{ width: 75 }} readOnly className="readonly-input" />
                </Form.Item>
                <Form.Item name="제품명" noStyle>
                  <Input style={{ width: 160 }} readOnly className="readonly-input" placeholder="제품명" />
                </Form.Item>
              </Space.Compact>
            </div>

            <div className="form-col">
              <span className="field-label">스캔</span>
              <Form.Item name="스캔" noStyle>
                <Input
                  size="small"
                  style={{ width: 180 }}
                  placeholder="바코드 스캔 후 Enter"
                  onPressEnter={handleBarcodeEnter}
                />
              </Form.Item>
            </div>
          </div>

          <div className="form-row">
            <div className="form-col">
              <span className="field-label">로트번호</span>
              <Form.Item name="로트번호" noStyle>
                <Input size="small" style={{ width: 180 }} placeholder="로트번호 입력" />
              </Form.Item>
            </div>

            <div className="form-col">
              <span className="field-label">일련번호</span>
              <Form.Item name="일련번호" noStyle>
                <Input size="small" style={{ width: 310 }} placeholder="일련번호 입력" />
              </Form.Item>
            </div>

            <div className="form-col">
              <span className="field-label">AGG번호</span>
              <Form.Item name="AGG번호" noStyle>
                <Input size="small" style={{ width: 180 }} placeholder="AGG번호 입력" />
              </Form.Item>
            </div>
          </div>
        </Form>
      </div>

      <div className="serial-table-wrapper" ref={tableWrapperRef}>
        <div style={{ width: '100%', height: gridHeight }}>
          <DataEditor
            key={gridKey}
            getCellContent={getCellContent}
            columns={GRID_COLUMNS}
            rows={rowCount}
            rowMarkers="none"
            headerHeight={28}
            rowHeight={26}
            smoothScrollX
            smoothScrollY
            verticalBorder
            height={gridHeight}
            width="100%"
            gridSelection={gridSelection}
            onGridSelectionChange={handleGridSelectionChange}
            onCellClicked={handleCellClicked}
            theme={{
              accentColor: '#0055ff',
              accentLight: 'rgba(0, 0, 0, 0)',
              bgHeader: '#eef3f8',
              textHeader: '#1e293b',
              fontFamily: '"Malgun Gothic", "Dotum", sans-serif',
              baseFontStyle: '12px',
              headerFontStyle: 'bold 12px',
              borderColor: '#cbd5e1',
              cellHorizontalPadding: 8,
            }}
          />
        </div>
      </div>

      <Modal
        title="[T2020D] 일련번호 상세조회"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)}>
            닫기
          </Button>,
        ]}
        width={960}
        destroyOnClose
      >
        <div style={{ height: 260 }}>
          <DataEditor
            getCellContent={([cIdx, rIdx]) => {
              const row = detailList[rIdx] || {};
              const cols = [
                '출고확정번호', '고객사전표번호', '출고일자', '납품처코드', '납품처명',
                '제품코드', '표준코드', '고객사제품코드', '제품명', '제품등급명',
                '유통기한', '일련번호', '로트번호', 'AGG1차', 'AGG2차', 'AGG3차', 'AGG4차'
              ];
              const key = cols[cIdx];
              const val = row[key] !== undefined ? String(row[key]) : '';
              return {
                kind: GridCellKind.Text,
                allowOverlay: false,
                readonly: true,
                displayData: val,
                data: val,
                contentAlign: key.includes('일자') ? 'center' : 'left',
              };
            }}
            columns={[
              { id: '출고확정번호', title: '출고확정번호', width: 110 },
              { id: '고객사전표번호', title: '고객사전표번호', width: 120 },
              { id: '출고일자', title: '출고일자', width: 85 },
              { id: '납품처코드', title: '납품처코드', width: 85 },
              { id: '납품처명', title: '납품처명', width: 120 },
              { id: '제품코드', title: '제품코드', width: 85 },
              { id: '표준코드', title: '표준코드', width: 85 },
              { id: '고객사제품코드', title: '고객사제품코드', width: 100 },
              { id: '제품명', title: '제품명', width: 140 },
              { id: '제품등급명', title: '제품등급명', width: 85 },
              { id: '유통기한', title: '유통기한', width: 85 },
              { id: '일련번호', title: '일련번호', width: 120 },
              { id: '로트번호', title: '로트번호', width: 85 },
              { id: 'AGG1차', title: 'AGG1차', width: 110 },
              { id: 'AGG2차', title: 'AGG2차', width: 110 },
              { id: 'AGG3차', title: 'AGG3차', width: 110 },
              { id: 'AGG4차', title: 'AGG4차', width: 110 },
            ]}
            rows={detailList.length}
            rowMarkers="none"
            headerHeight={26}
            rowHeight={24}
            verticalBorder
            height={250}
            width="100%"
            theme={{
              bgHeader: '#f1f5f9',
              fontFamily: '"Malgun Gothic", sans-serif',
              baseFontStyle: '12px',
              headerFontStyle: 'bold 12px',
            }}
          />
        </div>
      </Modal>
    </div>
  );
}