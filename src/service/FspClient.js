import { jsonToNexacroXml } from './nexacroXml';
import { NexacroDataset } from './NexacroDataset';
import axios from 'axios';

// [Web Worker] 순수 XML 전용 초고속 파서 (정규식 제거 및 indexOf 기반 경량 파싱)
const xmlWorkerCode = `
self.onmessage = function(e) {
  const { rawText } = e.data;
  try {
    const text = typeof rawText === 'string' ? rawText : '';
    const result = parseNexacroXML(text);
    self.postMessage({ status: 'SUCCESS', result });
  } catch (err) {
    self.postMessage({ status: 'ERROR', error: err.message });
  }
};

function parseNexacroXML(text) {
  const parameters = {};
  const datasets = {};

  if (!text) return { parameters, datasets };

  // 1. Variable 파싱
  let vPos = 0;
  while ((vPos = text.indexOf('<Variable', vPos)) !== -1) {
    const idStart = text.indexOf('id="', vPos) + 4;
    const idEnd = text.indexOf('"', idStart);
    const varId = text.substring(idStart, idEnd);

    const valStart = text.indexOf('>', idEnd) + 1;
    const valEnd = text.indexOf('</Variable>', valStart);
    parameters[varId] = valEnd !== -1 ? text.substring(valStart, valEnd) : '';
    vPos = valEnd !== -1 ? valEnd + 11 : valStart;
  }

  // 2. Dataset 파싱
  let dsPos = 0;
  while ((dsPos = text.indexOf('<Dataset', dsPos)) !== -1) {
    const idStart = text.indexOf('id="', dsPos) + 4;
    const idEnd = text.indexOf('"', idStart);
    const dsName = text.substring(idStart, idEnd);

    const dsEnd = text.indexOf('</Dataset>', idEnd);
    const dsContent = dsEnd !== -1 ? text.substring(idEnd, dsEnd) : text.substring(idEnd);
    dsPos = dsEnd !== -1 ? dsEnd + 10 : text.length;

    const rows = parseXmlRows(dsContent);
    datasets[dsName] = { rows };
  }

  return { parameters, datasets };
}

function parseXmlRows(dsContent) {
  const rows = [];
  let rowPos = 0;
  const colKeyCache = {};

  while ((rowPos = dsContent.indexOf('<Row>', rowPos)) !== -1) {
    const rowEnd = dsContent.indexOf('</Row>', rowPos);
    if (rowEnd === -1) break;

    const rowContent = dsContent.substring(rowPos + 5, rowEnd);
    rowPos = rowEnd + 6;

    const rowObj = {};
    let colPos = 0;

    while ((colPos = rowContent.indexOf('<Col id="', colPos)) !== -1) {
      const colIdStart = colPos + 9;
      const colIdEnd = rowContent.indexOf('"', colIdStart);
      const rawCol = rowContent.substring(colIdStart, colIdEnd);

      let colName = colKeyCache[rawCol];
      if (!colName) {
        colName = String(rawCol);
        colKeyCache[rawCol] = colName;
      }

      const valStart = rowContent.indexOf('>', colIdEnd) + 1;
      const valEnd = rowContent.indexOf('</Col>', valStart);
      if (valEnd === -1) break;

      let val = rowContent.substring(valStart, valEnd);
      if (val.includes('<![CDATA[')) {
        val = val.replace(/<!\\[CDATA\\[/g, '').replace(/\\]\\]>/g, '');
      }

      // SlicedString 포인터 절단
      rowObj[colName] = val.length < 16 ? ('' + val) : val.slice(0);
      colPos = valEnd + 6;
    }

    rows.push(rowObj);
  }

  return rows;
}
`;

export class FspClient {
  constructor(userInfo = {}) {
    this.userInfo = userInfo;
    this.fspCurrBiz = '';
    this.timeout = 10 * 60 * 1000;

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
    if (this.cmdDataset) {
      this.cmdDataset.rows = [];
      this.cmdDataset.rowTypes = [];
      this.cmdDataset.position = -1;
    }
  }

  destroy() {
    this.fsp_clear();
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

  /**
   * [100건 조기 수신 + 스트리밍 트리거]
   * 서버 FSP 엔진에 초기 100건 선출력을 지시하는 설정 유지
   */
  fsp_addCSVSearch(sqlName, chunkSize = 100) {
    this.fsp_add('C', sqlName, '', '', '', '', '', '', '', 0, 'B');
    const lastRow = this.cmdDataset.getCurrentRow();
    if (lastRow) {
      lastRow.PAGE_SIZE = Number(chunkSize);
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

  // 단발성 Worker 실행 및 파싱 종료 즉시 완전 소각(terminate)
  parseInWorker(rawText) {
    return new Promise((resolve, reject) => {
      let workerUrl = null;
      let worker = null;

      try {
        const blob = new Blob([xmlWorkerCode], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
          const { status, result, error } = e.data;
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          worker = null;
          workerUrl = null;

          if (status === 'SUCCESS') {
            resolve(result);
          } else {
            reject(new Error(error || 'Worker 파싱 에러'));
          }
        };

        worker.onerror = (err) => {
          if (worker) worker.terminate();
          if (workerUrl) URL.revokeObjectURL(workerUrl);
          reject(err);
        };

        worker.postMessage({ rawText });
      } catch (err) {
        if (worker) worker.terminate();
        if (workerUrl) URL.revokeObjectURL(workerUrl);
        reject(err);
      }
    });
  }

  buildPayload(actionName, cmdName, inputDatasets = {}, otherArg = '') {
    const actName = actionName ? actionName : 'nDefaultAction';
    const cName = cmdName ? cmdName : 'execute';

    const parameters = {
      fsp_action: actName,
      fsp_cmd: cName,
      fsp_loginKey: `${this.userInfo.sessionId || '202608300955191804796'}|${this.userInfo.userKey || '201707180000000000000000000002'}`,
      fsp_logId: 'all',
    };

    if (otherArg && typeof otherArg === 'string') {
      const pairs = otherArg.trim().split(/\s+/);
      pairs.forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) parameters[k] = v || '';
      });
    }

    const processedDatasets = {};
    Object.keys(inputDatasets).forEach((key) => {
      const ds = inputDatasets[key];
      if (ds && typeof ds.toPlainObject === 'function') {
        processedDatasets[key] = ds.toPlainObject();
      } else if (ds) {
        processedDatasets[key] = ds;
      }
    });

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

    return jsonToNexacroXml(parameters, datasets);
  }

  // 일반 단건 조회 (로그인, 메뉴, 팝업)
  async fsp_callService(actionName, cmdName, inputDatasets = {}, otherArg = '') {
    const requestData = this.buildPayload(actionName, cmdName, inputDatasets, otherArg);

    try {
      const response = await axios.post('/NMain', requestData, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Accept': 'text/xml, application/xml, text/plain, */*',
        },
        responseType: 'text',
        timeout: this.timeout,
      });

      const rawResult = await this.parseInWorker(response.data);
      const resParams = rawResult.parameters || {};

      if (resParams.ErrorCode !== undefined && Number(resParams.ErrorCode) < 0) {
        const errMsg = resParams.ErrorMsg || '서버 처리 중 오류가 발생했습니다.';
        console.error(`[FspClient] FSP Error [${resParams.ErrorCode}]:`, errMsg);
        throw new Error(`[FSP ${resParams.ErrorCode}] ${errMsg}`);
      }

      const sourceDatasets = rawResult.datasets || {};
      const resultMap = {};

      Object.keys(sourceDatasets).forEach((dsName) => {
        if (dsName === 'parameters') return;
        const dsData = sourceDatasets[dsName];
        const datasetInstance = new NexacroDataset(dsName);
        datasetInstance.loadData(Array.isArray(dsData) ? dsData : (dsData?.rows || []));
        resultMap[dsName] = datasetInstance;
      });

      this.destroy();

      return {
        parameters: resParams,
        datasets: resultMap,
        ...resultMap,
      };
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  // 대용량 스트리밍 조회 (초기 100건 선표출 + 완료 시 단 1회 파싱)
  async fsp_callServiceStream(actionName, cmdName, inputDatasets = {}, otherArg = '', onProgress) {
    const requestData = this.buildPayload(actionName, cmdName, inputDatasets, otherArg);

    const response = await fetch('/NMain', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Accept': 'text/plain, text/xml, application/xml, */*',
      },
      body: requestData,
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let isFirstChunkFired = false;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        // 초기 100건 조기 감지 (첫 </Row> 블록 발견 시 단 1회 프리뷰)
        if (!isFirstChunkFired && (buffer.length >= 35000 || done)) {
          if (buffer.includes('</Row>')) {
            const lastRowIdx = buffer.lastIndexOf('</Row>');
            const chunkToParse = buffer.substring(0, lastRowIdx + 6) + '</Rows></Dataset></Root>';

            try {
              const parsed = await this.parseInWorker(chunkToParse);
              const targetDs = parsed.datasets?.ds_oList || Object.values(parsed.datasets || {})[0];
              const rows = targetDs?.rows || (Array.isArray(targetDs) ? targetDs : []);

              if (rows.length >= 10 || done) {
                isFirstChunkFired = true;
                if (onProgress) {
                  onProgress(rows, true, false);
                }
              }
            } catch (e) {
              // 파싱 실패 시 다음 버퍼 누적 대기
            }
          }
        }

        // 전체 수신 완료 시
        if (done) {
          const rawText = buffer;
          buffer = ''; // 100MB+ 원본 텍스트 즉시 해제

          const workerResult = await this.parseInWorker(rawText);
          const targetDs = workerResult.datasets?.ds_oList || Object.values(workerResult.datasets || {})[0];
          const allRows = targetDs?.rows || (Array.isArray(targetDs) ? targetDs : []);

          if (!isFirstChunkFired && onProgress) {
            onProgress(allRows, true, false);
          }

          if (onProgress) {
            onProgress(allRows, false, true);
          }

          this.destroy();

          return {
            parameters: workerResult.parameters || {},
            rows: allRows,
          };
        }
      }
    } catch (err) {
      reader.cancel();
      this.destroy();
      throw err;
    }
  }
}