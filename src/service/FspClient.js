import { jsonToNexacroXml, nexacroXmlToJson } from './nexacroXml';
import { NexacroDataset } from './NexacroDataset';
import axios from 'axios';

export class FspClient {
  constructor(userInfo = {}) {
    this.userInfo = userInfo;
    this.fspCurrBiz = '';

    // 커맨드 데이터셋 메타데이터
    const cmdColumns = [
      { id: 'TX_NAME', type: 'string', size: '100' },
      { id: 'TYPE', type: 'string', size: '10' },
      { id: 'SQL_ID', type: 'string', size: '200' },
      { id: 'KEY_SQL_ID', type: 'string', size: '200' },
      { id: 'KEY_INCREMENT', type: 'int', size: '10' },
      { id: 'CALLBACK_SQL_ID', type: 'string', size: '200' },
      { id: 'INSERT_SQL_ID', type: 'string', size: '200' },
      { id: 'UPDATE_SQL_ID', type: 'string', size: '200' },
      { id: 'DELETE_SQL_ID', type: 'string', size: '200' },
      { id: 'SAVE_FLAG_COLUMN', type: 'string', size: '200' },
      { id: 'USE_INPUT', type: 'string', size: '1' },
      { id: 'USE_ORDER', type: 'string', size: '1' },
      { id: 'KEY_ZERO_LEN', type: 'int', size: '10' },
      { id: 'BIZ_NAME', type: 'string', size: '100' },
      { id: 'PAGE_NO', type: 'int', size: '10' },
      { id: 'PAGE_SIZE', type: 'int', size: '10' },
      { id: 'READ_ALL', type: 'string', size: '1' },
      { id: 'EXEC_TYPE', type: 'string', size: '2' },
      { id: 'EXEC', type: 'string', size: '1' },
      { id: 'FAIL', type: 'string', size: '1' },
      { id: 'FAIL_MSG', type: 'string', size: '200' },
      { id: 'EXEC_CNT', type: 'int', size: '1' },
      { id: 'MSG', type: 'string', size: '200' },
    ];

    this.cmdDataset = new NexacroDataset('fsp_ds_cmd', cmdColumns, []);
  }

  fsp_setBiz(newBizName) {
    this.fspCurrBiz = newBizName;
  }

  fsp_clear() {
    this.fspCurrBiz = '';
    this.cmdDataset.rows = [];
    this.cmdDataset.rowTypes = [];
    this.cmdDataset.position = -1;
  }

  fsp_add(
    txType,
    sqlName,
    keySqlName,
    keyIncrement,
    callbackSql,
    insertSql,
    updateSql,
    deleteSql,
    saveFlagColumn,
    keyZeroLen,
    execType
  ) {
    if (keyIncrement === undefined || keyIncrement < 0) keyIncrement = '0';
    if (keyZeroLen === undefined || keyZeroLen < 0) keyZeroLen = '0';

    const row = {
      TX_NAME: '',
      TYPE: txType,
      SQL_ID: sqlName || '',
      KEY_SQL_ID: keySqlName || '',
      KEY_INCREMENT: String(keyIncrement),
      CALLBACK_SQL_ID: callbackSql || '',
      INSERT_SQL_ID: insertSql || '',
      UPDATE_SQL_ID: updateSql || '',
      DELETE_SQL_ID: deleteSql || '',
      SAVE_FLAG_COLUMN: saveFlagColumn || '',
      USE_INPUT: 'N',
      USE_ORDER: 'Y',
      KEY_ZERO_LEN: String(keyZeroLen),
      BIZ_NAME: this.fspCurrBiz,
      PAGE_NO: 0,
      PAGE_SIZE: 0,
      READ_ALL: 'N',
      EXEC_TYPE: execType || 'B',
      EXEC: 'N',
      FAIL: 'N',
      FAIL_MSG: '',
      EXEC_CNT: 0,
      MSG: '',
    };

    this.cmdDataset.addRow(row);
  }

  fsp_addSearch(sqlName, isUseInput = false, isNotUseOrder = false) {
    this.fsp_add('N', sqlName, '', '', '', '', '', '', '', 0, 'B');
    const lastRow = this.cmdDataset.getCurrentRow();
    if (lastRow) {
      if (isUseInput) lastRow.USE_INPUT = 'Y';
      if (isNotUseOrder) lastRow.USE_ORDER = 'N';
    }
  }

  fsp_addPageSearch(
    sqlName,
    pageNo,
    pageSize,
    isAllRead = false,
    isUseInput = false,
    isNotUseOrder = false
  ) {
    this.fsp_addSearch(sqlName, isUseInput, isNotUseOrder);
    const lastRow = this.cmdDataset.getCurrentRow();
    if (lastRow) {
      lastRow.READ_ALL = isAllRead ? 'Y' : 'N';
      lastRow.PAGE_NO = Number(pageNo);
      lastRow.PAGE_SIZE = Number(pageSize);
    }
  }

  fsp_addSave(
    insertSql,
    updateSql,
    deleteSql,
    saveFlagColumn,
    keySqlName,
    keyIncrement,
    callbackSql,
    keyZeroLen,
    execType
  ) {
    this.fsp_add(
      'S',
      '',
      keySqlName,
      keyIncrement,
      callbackSql,
      insertSql,
      updateSql,
      deleteSql,
      saveFlagColumn,
      keyZeroLen,
      execType
    );
  }

  fsp_addSingle(sqlName, keySqlName, keyIncrement, callbackSql, execType) {
    this.fsp_add('N', sqlName, keySqlName, keyIncrement, callbackSql, '', '', '', '', 0, execType);
  }

  /**
   * 서버 호출 함수
   * @param {string} actionName 
   * @param {string} cmdName 
   * @param {Object} inputDatasets { ds_iData: dsInstance1, ds_iList: dsInstance2, ... }
   * @param {string} otherArg 추가 파라미터 (예: "a=1 b=2")
   * @returns {Promise<Object>} 수신된 모든 Dataset이 NexacroDataset 인스턴스로 매핑된 결과 객체
   */
  async fsp_callService(actionName, cmdName, inputDatasets = {}, otherArg = '') {
    const actName = actionName ? actionName : 'nDefaultAction';
    const cName = cmdName ? cmdName : 'execute';

    const parameters = {
      fsp_action: actName,
      fsp_cmd: cName,
      fsp_loginKey: `${this.userInfo.sessionId || '202608300955191804796'}|${this.userInfo.userKey || '201707180000000000000000000002'}`,
      fsp_logId: 'all',
    };

    // 기타 파라미터 파싱
    if (otherArg && typeof otherArg === 'string') {
      const pairs = otherArg.trim().split(/\s+/);
      pairs.forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) parameters[k] = v || '';
      });
    }

    // 전달받은 모든 inputDataset 검증 및 변환
    const processedDatasets = {};
    Object.keys(inputDatasets).forEach((key) => {
      const ds = inputDatasets[key];
      if (ds && typeof ds.toPlainObject === 'function') {
        processedDatasets[key] = ds.toPlainObject();
      } else if (ds) {
        processedDatasets[key] = ds;
      }
    });

    // 전송 대상 전체 데이터셋 구성
    const datasets = {
      ...processedDatasets,
      fsp_ds_cmd: this.cmdDataset.toPlainObject(),
      ds_userInfo: {
        columns: [
          { id: '사용자ID', type: 'string', size: '30' },
          { id: '회사코드', type: 'string', size: '30' },
          { id: 'SESSION_ID', type: 'string', size: '1' },
          { id: '프로그램ID', type: 'string', size: '100' },
        ],
        rows: [
          {
            사용자ID: this.userInfo.userId || 'REDBOMBZ',
            회사코드: this.userInfo.companyCode || '00003',
            SESSION_ID: this.userInfo.sessionId || '202608300955191804796',
            프로그램ID: 'REACT_CLIENT',
          },
        ],
      },
    };

    const xmlData = jsonToNexacroXml(parameters, datasets);

    try {
      const response = await axios.post('/NMain', xmlData, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Accept': 'text/xml, application/xml',
        },
        responseType: 'text',
        timeout: 15000, // 15초 타임아웃
      });

      const rawJsonResult = nexacroXmlToJson(response.data) || {};
      const resParams = rawJsonResult.parameters || {};

      // 넥사크로 FSP 프레임워크 비즈니스 에러 검사 (ErrorCode < 0)
      if (resParams.ErrorCode !== undefined && Number(resParams.ErrorCode) < 0) {
        const errMsg = resParams.ErrorMsg || '서버 처리 중 오류가 발생했습니다.';
        console.error(`[FspClient] FSP Server Business Error [${resParams.ErrorCode}]:`, errMsg);
        throw new Error(`[FSP ${resParams.ErrorCode}] ${errMsg}`);
      }

      // 서버 응답 내부의 모든 Dataset 추출
      const sourceDatasets = rawJsonResult.datasets || {};
      const resultMap = {};

      Object.keys(sourceDatasets).forEach((dsName) => {
        if (dsName === 'parameters') return;

        const dsData = sourceDatasets[dsName];
        const datasetInstance = new NexacroDataset(dsName);
        datasetInstance.loadData(dsData);

        resultMap[dsName] = datasetInstance;
      });

      return {
        raw: rawJsonResult,
        parameters: resParams,
        datasets: resultMap,
        ...resultMap,
      };
    } catch (error) {
      if (error.response) {
        console.error(
          `[FspClient HTTP Error] Status: ${error.response.status}, Data:`,
          error.response.data
        );
      } else if (error.request) {
        console.error(
          '[FspClient Network Error] 백엔드(8080) 연결 실패 또는 프록시 타임아웃:',
          error.message
        );
      } else {
        console.error('[FspClient Error]:', error.message);
      }
      throw error;
    }
  }
}