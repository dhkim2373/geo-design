import React, { useRef } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, message, Form } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
// 위에서 구현된 FspClient 임포트
import { FspClient } from '@/service/FspClient';

const BuildingManagement = () => {
  const actionRef = useRef();
  const [form] = Form.useForm();

  // ProTable 컬럼 정의 (넥사크로 그리드 포맷 1:1 매칭)
  const columns = [
    {
      title: 'NO',
      dataIndex: 'index',
      valueType: 'index',
      width: 50,
      search: false,
    },
    {
      title: '주소',
      dataIndex: '주소',
      search: false,
    },
    {
      title: '상호명',
      dataIndex: '상호명',
      copyable: true,
    },
    {
      title: '지점명',
      dataIndex: '지점명',
      search: false,
    },
    {
      title: '업종대분류',
      dataIndex: '상권업종대분류명',
      search: false,
    },
    {
      title: '업종중분류',
      dataIndex: '상권업종중분류명',
      search: false,
    },
    {
      title: '업종소분류',
      dataIndex: '상권업종소분류명',
      search: false,
    },
    {
      title: '건물명',
      dataIndex: '건물명',
    },
    {
      title: '우편번호',
      dataIndex: '우편번호',
      search: false,
    },
    {
      title: '지번주소',
      dataIndex: '지번주소',
      search: false,
    },
    {
      title: '층정보',
      dataIndex: '층정보',
      search: false,
    },
    {
      title: '네이버지도',
      valueType: 'option',
      key: 'map',
      search: false,
      render: (_, record) => (
        <a
          onClick={() => {
            const sBun = record.지번본번지 || '';
            const sJi = record.지번부번지 || '';
            let url = `https://map.naver.com/v5/search/%EC%97%AC%EC%9D%98%EB%8F%84%EB%8F%99%20${sBun}`;
            if (sJi && sJi !== '0') {
              url += `-${sJi}`;
            }
            window.open(url, '_blank');
          }}
        >
          보기
        </a>
      ),
    },
  ];

  /**
   * FspClient를 통한 실제 백엔드 상가 조회 연동 함수
   */
  const fetchBuildingData = async (params = {}) => {
    try {
      // 1. FspClient 인스턴스 생성
      const fsp = new FspClient();

      // 2. 넥사크로 소스의 fsp_addSearch 로직과 동일하게 액션 추가
      fsp.fsp_clear();
      fsp.fsp_addSearch('brk/building:bld_상가조회_조회_s01', false);

      // 3. 넥사크로의 ds_search0 데이터셋 구조에 매칭되는 입력 데이터 구성
      const inputList = [
        {
          서비스: '행정동_상가업소조회',
          행정동코드: params.행정동코드 || '1156054000',
          대분류코드: params.대분류코드 || '',
          중분류코드: params.중분류코드 || '',
          소분류코드: params.소분류코드 || '',
          상호명: params.상호명 || '',
          건물명: params.건물명 || '',
        },
      ];

      // 4. fsp_callService 호출 (inData 매핑: ds_iList)
      const response = await fsp.fsp_callService('', '', {
        ds_iList: {
          columns: [
            { id: '서비스', type: 'string', size: '256' },
            { id: '행정동코드', type: 'string', size: '256' },
            { id: '대분류코드', type: 'string', size: '256' },
            { id: '중분류코드', type: 'string', size: '256' },
            { id: '소분류코드', type: 'string', size: '256' },
            { id: '상호명', type: 'string', size: '256' },
            { id: '건물명', type: 'string', size: '256' },
          ],
          rows: inputList,
        },
      });

      // 5. 서버 응답 결과(ds_oList) 추출 후 ProTable 규격에 맞게 반환
      const resultList = response?.ds_oList || [];

      return {
        data: resultList,
        success: true,
        total: resultList.length,
      };
    } catch (error) {
      console.error('상가조회 FSP 통신 오류:', error);
      message.error('데이터를 불러오는 중 오류가 발생했습니다.');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  return (
    <PageContainer header={{ title: '내물건관리 (상가업소 조회)' }}>
      <ProTable
        headerTitle="상가 목록"
        actionRef={actionRef}
        rowKey="id"
        form={form}
        search={{
          labelWidth: 90,
          searchText: '조회',
          resetText: '초기화',
        }}
        toolBarRender={() => [
          <Button
            key="update"
            type="primary"
            onClick={() => {
              message.success('상가정보 갱신 로직 실행');
            }}
          >
            상가정보갱신
          </Button>,
          <Button
            key="excel"
            icon={<ExportOutlined />}
            onClick={() => {
              message.success('엑셀 다운로드 실행');
            }}
          >
            엑셀 다운로드
          </Button>,
        ]}
        // ProTable에서 조회 버튼이나 페이징 동작 시 FspClient 연동 함수 실행
        request={async (params) => {
          return await fetchBuildingData(params);
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
        columns={columns}
      />
    </PageContainer>
  );
};

export default BuildingManagement;