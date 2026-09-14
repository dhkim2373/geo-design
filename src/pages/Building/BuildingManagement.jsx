import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ProTable } from '@ant-design/pro-components';
import { Button, message, Tabs, Form, Input } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { NexacroDataset } from '@/service/nexacroDataset';
import './buildingManagement.less';

const BuildingManagement = () => {
  const [activeTab, setActiveTab] = useState('2');
  const [formTab1] = Form.useForm();
  const [formTab2] = Form.useForm();

  const actionRef1 = useRef();
  const actionRef2 = useRef();

  // 각 탭별 컨테이너 DOM 참조
  const tableWrapperRef1 = useRef(null);
  const tableWrapperRef2 = useRef(null);

  // 동적 계산된 테이블 본체 세로 높이
  const [scrollY, setScrollY] = useState(500);

  // 인라인 편집 시 강제 렌더링용 트리거
  const [, setForceUpdate] = useState({});

  // 화면 요소의 실제 Y좌표와 하단 상태바 위치를 계산하여 남은 공간을 최대로 사용
  const calculateTableHeight = useCallback(() => {
    const activeWrapper = activeTab === '1' ? tableWrapperRef1.current : tableWrapperRef2.current;
    if (!activeWrapper) return;

    // 테이블 헤더(.ant-table-thead) 하단 경계선 위치 확인
    const tableHeader = activeWrapper.querySelector('.ant-table-thead');

    if (tableHeader) {
      const rect = tableHeader.getBoundingClientRect();
      const statusBarHeight = 25; // MdiLayout 하단 상태바 높이
      const bottomSpacing = 4; // 바닥과의 최소 여백

      // 브라우저 윈도우 높이 - 컬럼 헤더 하단 위치 - 상태바 높이 - 최소여백
      const availableHeight = window.innerHeight - rect.bottom - statusBarHeight - bottomSpacing;
      if (availableHeight > 120) {
        setScrollY(Math.floor(availableHeight));
      }
    }
  }, [activeTab]);

  // 브라우저 리사이즈, 탭 전환 시 높이 자동 재계산
  useEffect(() => {
    calculateTableHeight();

    const handleResize = () => {
      calculateTableHeight();
    };

    window.addEventListener('resize', handleResize);
    const timer1 = setTimeout(calculateTableHeight, 50);
    const timer2 = setTimeout(calculateTableHeight, 200);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [calculateTableHeight, activeTab]);

  // 탭 간 전환 시 파라미터 유실 방지용 state
  const [searchParams1, setSearchParams1] = useState({ 번: '', 지: '' });

  // 각 탭별 NexacroDataset 인스턴스 (상태 머신 유지)
  const ds1Ref = useRef(new NexacroDataset('ds_list1'));
  const ds2Ref = useRef(new NexacroDataset('ds_list2'));

  // 비고 실시간 인라인 수정 핸들러 (NexacroDataset의 set 호출 -> rowType: 2 갱신)
  const handleBigoChange = (tabIndex, index, value) => {
    if (tabIndex === '1') {
      ds1Ref.current.set(index, '비고', value);
    } else if (tabIndex === '2') {
      ds2Ref.current.set(index, '비고', value);
    }
    setForceUpdate({});
  };

  // 1. 구분면적조회 탭 컬럼
  const columnsTab1 = [
    { title: 'NO', valueType: 'index', width: 50, search: false, align: 'center' },
    { title: '번', dataIndex: '번', hideInTable: true },
    { title: '지', dataIndex: '지', hideInTable: true },
    { title: '층', dataIndex: '층', hideInTable: true },
    { title: '공급(㎡)', dataIndex: '공급면적', hideInTable: true },
    { title: '전용(㎡)', dataIndex: '전용면적', hideInTable: true },
    { title: '주소', dataIndex: '주소', search: false, width: 260 },
    { title: '빌딩명', dataIndex: '빌딩명', copyable: true, search: false, width: 140 },
    { title: '호명칭', dataIndex: '호명칭', search: false, width: 90 },
    {
      title: '비고',
      dataIndex: '비고',
      width: 250,
      search: false,
      onCell: () => ({
        style: { backgroundColor: '#fffbe6' },
      }),
      render: (_, record, index) => (
        <Input
          size="small"
          value={ds1Ref.current.get(index, '비고') ?? record.비고 ?? ''}
          placeholder="비고 입력"
          style={{ backgroundColor: 'transparent', border: '1px solid #ffe58f' }}
          onChange={(e) => handleBigoChange('1', index, e.target.value)}
        />
      ),
    },
    {
      title: '첨부파일',
      dataIndex: '파일첨부',
      search: false,
      width: 90,
      align: 'center',
      render: (_, record) =>
        record.파일첨부 ? (
          <a
            onClick={() => {
              const fileName = record.파일첨부;
              const path = fileName.split('/');
              const url = `/downloadWeb?fileName=${path[path.length - 1]}`;
              window.open(url, '_blank');
            }}
          >
            다운로드
          </a>
        ) : (
          '-'
        ),
    },
    { title: '공급면적', dataIndex: '공급면적', search: false, width: 90 },
    { title: '전용면적', dataIndex: '전용면적', search: false, width: 90 },
    { title: '공급(평)', dataIndex: '공급면적_평', search: false, width: 80 },
    { title: '전용(평)', dataIndex: '전용면적_평', search: false, width: 80 },
    { title: '층번호', dataIndex: '층번호', search: false, width: 70, align: 'center' },
    { title: '건물층수', dataIndex: '건물층수', search: false, width: 70, align: 'center' },
  ];

  // 2. 건물조회 탭 컬럼
  const columnsTab2 = [
    { title: 'NO', valueType: 'index', width: 50, search: false, align: 'center' },
    { title: '주소', dataIndex: '주소', width: 280, copyable: true },
    { title: '건물명', dataIndex: '시군구용건물명', search: false, width: 150 },
    { title: '우편번호', dataIndex: '우편번호', width: 90, search: false, align: 'center' },
    { title: '사용승인일', dataIndex: '사용승인일', width: 100, align: 'center' },
    { title: '층수', dataIndex: '건물층수', width: 70, align: 'center' },
    {
      title: '면적조회',
      valueType: 'option',
      search: false,
      width: 80,
      align: 'center',
      render: (_, record) =>
        record.면적보기지원여부 === '1' ? (
          <a
            onClick={() => {
              const targetBun = record.지번본번 || '';
              const targetJi = record.지번부번 || '';

              formTab1.setFieldsValue({
                번: targetBun,
                지: targetJi,
                층: '',
                공급면적: '',
                전용면적: '',
              });

              setSearchParams1({ 번: targetBun, 지: targetJi });
              setActiveTab('1');
              setTimeout(() => {
                actionRef1.current?.reload();
              }, 50);
            }}
          >
            면적
          </a>
        ) : null,
    },
    {
      title: '네이버지도',
      valueType: 'option',
      search: false,
      width: 80,
      align: 'center',
      render: (_, record) => (
        <a
          onClick={() => {
            const sBun = record.지번본번 || '';
            const sJi = record.지번부번 || '';
            let url = `https://map.naver.com/v5/search/%EC%97%AC%EC%9D%98%EB%8F%84%EB%8F%99%20${sBun}`;
            if (sJi && sJi !== '0') url += `-${sJi}`;
            window.open(url, '_blank');
          }}
        >
          보기
        </a>
      ),
    },
    {
      title: '비고',
      dataIndex: '비고',
      width: 320,
      search: false,
      onCell: () => ({
        style: { backgroundColor: '#fffbe6' },
      }),
      render: (_, record, index) => (
        <Input
          size="small"
          value={ds2Ref.current.get(index, '비고') ?? record.비고 ?? ''}
          placeholder="비고 입력"
          style={{ backgroundColor: 'transparent', border: '1px solid #ffe58f' }}
          onChange={(e) => handleBigoChange('2', index, e.target.value)}
        />
      ),
    },
  ];

  // 비고 저장 핸들러
  const handleSaveBigo = async (tabIndex) => {
    try {
      const targetDs = tabIndex === '1' ? ds1Ref.current : ds2Ref.current;

      if (!targetDs.isUpdated()) {
        message.warning('변경된 내용이 없습니다.');
        return;
      }

      const updateDataset = targetDs.getUpdateDataset('ds_iList');

      const fsp = new FspClient();
      fsp.fsp_clear();

      const updateSql =
        tabIndex === '1'
          ? 'brk/building:bld_건축물대장조회_구분면적조회_비고등록_u01'
          : 'brk/building:bld_건축물대장조회_비고등록_u01';

      fsp.fsp_addSave('', updateSql, '', '', '', 0, '', 0, 'B');

      await fsp.fsp_callService('', '', { ds_iList: updateDataset });

      message.success('저장되었습니다.');

      if (tabIndex === '1') actionRef1.current?.reload();
      if (tabIndex === '2') actionRef2.current?.reload();
    } catch (error) {
      console.error('비고 저장 오류:', error);
      message.error('저장 중 오류가 발생했습니다.');
    }
  };

  // FSP 조회 핸들러 (ProTable 내장 request로 단독 제어)
  const fetchData = async (tabIndex, params = {}) => {
    try {
      const fsp = new FspClient();
      fsp.fsp_clear();

      let inDataName = 'ds_iList';
      let inputData = {};

      if (tabIndex === '1') {
        fsp.fsp_addSearch('brk/building:bld_건축물대장조회_건물면적조회_s01', false);
        const formValues = formTab1.getFieldsValue();
        inputData = {
          번: params.번 ?? formValues.번 ?? searchParams1.번 ?? '',
          지: params.지 ?? formValues.지 ?? searchParams1.지 ?? '',
          층: params.층 ?? formValues.층 ?? '',
          공급면적: params.공급면적 ?? formValues.공급면적 ?? '',
          전용면적: params.전용면적 ?? formValues.전용면적 ?? '',
        };
      } else if (tabIndex === '2') {
        fsp.fsp_addSearch('brk/building:bld_건축물대장조회_건물조회_s01', false);
        inputData = {
          주소: params.주소 || '',
          사용승인일: params.사용승인일 || '',
          건물층수: params.건물층수 || '',
        };
      }

      const inputDataset = new NexacroDataset(
        inDataName,
        Object.keys(inputData).map((k) => ({ id: k, type: 'string', size: '256' })),
        [inputData]
      );

      const response = await fsp.fsp_callService('', '', { [inDataName]: inputDataset });

      let rawList = [];
      const ds =
        response?.ds_oList ||
        response?.ds_oData ||
        response?.datasets?.ds_oList ||
        response?.datasets?.ds_oData;

      if (ds instanceof NexacroDataset) {
        rawList = ds.rows || [];
      } else if (Array.isArray(ds)) {
        rawList = ds;
      } else if (ds?.rows && Array.isArray(ds.rows)) {
        rawList = ds.rows;
      }

      const targetDs = tabIndex === '1' ? ds1Ref.current : ds2Ref.current;
      targetDs.loadData(rawList);

      const formattedList = (targetDs.rows || []).map((item, idx) => ({
        ...item,
        uniqueRowKey: item.지번본번
          ? `${item.지번본번}_${item.지번부번 || '0'}_${idx}`
          : `row_${idx}`,
      }));

      setTimeout(calculateTableHeight, 50);

      return {
        data: formattedList,
        success: true,
        total: formattedList.length,
      };
    } catch (error) {
      console.error('FSP 통신 오류:', error);
      message.error('데이터 조회 중 오류가 발생했습니다.');
      return {
        data: [],
        success: true, // 에러 발생 시에도 true를 반환해야 로딩 스피너가 해제됨
        total: 0,
      };
    }
  };

  return (
    <div className="bld-mgmt-container">
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        className="bld-mgmt-tabs"
        items={[
          {
            key: '1',
            label: '구분면적조회',
            children: (
              <div className="bld-table-wrapper" ref={tableWrapperRef1}>
                <ProTable
                  headerTitle="구분 면적 목록"
                  actionRef={actionRef1}
                  form={formTab1}
                  rowKey="uniqueRowKey"
                  params={searchParams1}
                  search={{ labelWidth: 80, searchText: '조회' }}
                  request={async (params) => fetchData('1', params)}
                  columns={columnsTab1}
                  pagination={false}
                  scroll={{ y: scrollY, x: 'max-content' }}
                  toolBarRender={() => [
                    <Button
                      key="save"
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={() => handleSaveBigo('1')}
                    >
                      비고 저장
                    </Button>,
                  ]}
                />
              </div>
            ),
          },
          {
            key: '2',
            label: '건물조회',
            children: (
              <div className="bld-table-wrapper" ref={tableWrapperRef2}>
                <ProTable
                  headerTitle="건물 목록"
                  actionRef={actionRef2}
                  form={formTab2}
                  rowKey="uniqueRowKey"
                  search={{ labelWidth: 90, searchText: '조회' }}
                  request={async (params) => fetchData('2', params)}
                  columns={columnsTab2}
                  pagination={false}
                  scroll={{ y: scrollY, x: 'max-content' }}
                  toolBarRender={() => [
                    <Button
                      key="save"
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={() => handleSaveBigo('2')}
                    >
                      비고 저장
                    </Button>,
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default BuildingManagement;