import { jsonToNexacroXml } from './nexacroXml';
import { NexacroDataset } from './nexacroDataset';
import axios from 'axios';

// 공통 XML 엔티티 디코더 함수 (특수문자 및 &#32; 공백 변환용)
const xmlEntityDecoderSnippet = `
function decodeXmlEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&#32;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}
`;

// 1. [단건/로그인/메뉴 전용] 표준 XML 파서
const standardXmlWorkerCode = `
${xmlEntityDecoderSnippet}

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

  let vPos = 0;
  while ((vPos = text.indexOf('<Variable', vPos)) !== -1) {
    const idStart = text.indexOf('id="', vPos) + 4;
    const idEnd = text.indexOf('"', idStart);
    const varId = text.substring(idStart, idEnd);

    const valStart = text.indexOf('>', idEnd) + 1;
    const valEnd = text.indexOf('</Variable>', valStart);
    const rawVal = valEnd !== -1 ? text.substring(valStart, valEnd) : '';
    parameters[varId] = decodeXmlEntities(rawVal);
    vPos = valEnd !== -1 ? valEnd + 11 : valStart;
  }

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
      } else {
        val = decodeXmlEntities(val);
      }

      rowObj[colName] = val.length < 16 ? ('' + val) : val.slice(0);
      colPos = valEnd + 6;
    }

    rows.push(rowObj);
  }

  return rows;
}
`;

// 2. [대용량 스트리밍 전용] 밀집 배열 기반 파서 (엔티티 디코딩 및 조각 단위 파싱 지원)
const chunkedArrayWorkerCode = `
${xmlEntityDecoderSnippet}

self.onmessage = function(e) {
  const { rawText } = e.data;
  try {
    const text = typeof rawText === 'string' ? rawText : '';
    parseNexacroXMLAsArray(text);
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message });
  }
};

function parseNexacroXMLAsArray(text) {
  const parameters = {};
  if (!text) {
    self.postMessage({ type: 'DONE', parameters, columns: [], rows: [] });
    return;
  }

  let vPos = 0;
  while ((vPos = text.indexOf('<Variable', vPos)) !== -1) {
    const idStart = text.indexOf('id="', vPos) + 4;
    const idEnd = text.indexOf('"', idStart);
    const varId = text.substring(idStart, idEnd);

    const valStart = text.indexOf('>', idEnd) + 1;
    const valEnd = text.indexOf('</Variable>', valStart);
    const rawVal = valEnd !== -1 ? text.substring(valStart, valEnd) : '';
    parameters[varId] = decodeXmlEntities(rawVal);
    vPos = valEnd !== -1 ? valEnd + 11 : valStart;
  }

  const colInfoStart = text.indexOf('<ColumnInfo>');
  const colInfoEnd = text.indexOf('</ColumnInfo>', colInfoStart);
  const columnNames = [];

  if (colInfoStart !== -1 && colInfoEnd !== -1) {
    const colInfoStr = text.substring(colInfoStart + 12, colInfoEnd);
    let cPos = 0;
    while ((cPos = colInfoStr.indexOf('<Column', cPos)) !== -1) {
      const idIdx = colInfoStr.indexOf('id="', cPos);
      if (idIdx === -1) break;
      const idStart = idIdx + 4;
      const idEnd = colInfoStr.indexOf('"', idStart);
      const colId = colInfoStr.substring(idStart, idEnd);
      columnNames.push(colId);
      cPos = idEnd + 1;
    }
  }

  const colCount = columnNames.length;
  const colIndexMap = {};
  for (let i = 0; i < colCount; i++) {
    colIndexMap[columnNames[i]] = i;
  }

  const rowsStart = text.indexOf('<Rows>');
  const searchStart = rowsStart !== -1 ? rowsStart + 6 : 0;

  let rowPos = searchStart;
  const rows = [];

  while ((rowPos = text.indexOf('<Row>', rowPos)) !== -1) {
    const rowEnd = text.indexOf('</Row>', rowPos);
    if (rowEnd === -1) break;

    const rowContent = text.substring(rowPos + 5, rowEnd);
    rowPos = rowEnd + 6;

    const rowArr = new Array(colCount).fill('');
    let colPos = 0;
    let hasValue = false;

    while ((colPos = rowContent.indexOf('<Col id="', colPos)) !== -1) {
      const colIdStart = colPos + 9;
      const colIdEnd = rowContent.indexOf('"', colIdStart);
      const rawCol = rowContent.substring(colIdStart, colIdEnd);

      const valStart = rowContent.indexOf('>', colIdEnd) + 1;
      const valEnd = rowContent.indexOf('</Col>', valStart);
      if (valEnd === -1) break;

      let val = rowContent.substring(valStart, valEnd);
      if (val.includes('<![CDATA[')) {
        val = val.replace(/<!\\[CDATA\\[/g, '').replace(/\\]\\]>/g, '');
      } else {
        val = decodeXmlEntities(val); // 엔티티 디코딩 적용
      }

      const targetIdx = colIndexMap[rawCol];
      if (targetIdx !== undefined) {
        const cleanVal = val.length < 16 ? ('' + val) : val.slice(0);
        rowArr[targetIdx] = cleanVal;
        if (cleanVal !== '') {
          hasValue = true;
        }
      }

      colPos = valEnd + 6;
    }

    if (hasValue) {
      rows.push(rowArr);
    }
  }

  self.postMessage({ type: 'DONE', parameters, columns: columnNames, rows });
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

  parseInWorker(rawText) {
    return new Promise((resolve, reject) => {
      let workerUrl = null;
      let worker = null;

      try {
        const blob = new Blob([standardXmlWorkerCode], { type: 'application/javascript' });
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

  parseInWorkerFragment(rawText) {
    return new Promise((resolve, reject) => {
      let workerUrl = null;
      let worker = null;

      try {
        const blob = new Blob([chunkedArrayWorkerCode], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
          const { type, rows, parameters, columns, error } = e.data;
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          worker = null;
          workerUrl = null;

          if (type === 'DONE') {
            resolve({ rows: rows || [], parameters: parameters || {}, columns: columns || [] });
          } else {
            reject(new Error(error || 'Fragment Worker 파싱 에러'));
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

    // 전역 gds_userInfo 객체 참조 (NexacroDataset 객체이거나 일반 객체일 경우 대응)
    let globalUserInfo = null;
    if (typeof gds_userInfo !== 'undefined' && gds_userInfo) {
      globalUserInfo = typeof gds_userInfo.toPlainObject === 'function' 
        ? gds_userInfo.toPlainObject() 
        : gds_userInfo;
    } else if (typeof window !== 'undefined' && window.gds_userInfo) {
      globalUserInfo = typeof window.gds_userInfo.toPlainObject === 'function'
        ? window.gds_userInfo.toPlainObject()
        : window.gds_userInfo;
    }

    const datasets = {
      ...processedDatasets,
      fsp_ds_cmd: this.cmdDataset.toPlainObject(),
      ds_userInfo: globalUserInfo || { columns: [], rows: [] },
    };

    return jsonToNexacroXml(parameters, datasets);
  }

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
    let headerInfoChunk = '';
    let allRows = [];
    let columnNames = [];
    let parameters = {};
    let isFirstChunkFired = false;
    let hasHeaderExtracted = false;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        if (!hasHeaderExtracted) {
          const colInfoEndIdx = buffer.indexOf('</ColumnInfo>');
          if (colInfoEndIdx !== -1) {
            headerInfoChunk = buffer.substring(0, colInfoEndIdx + 13);
            hasHeaderExtracted = true;
          }
        }

        let lastRowIdx;
        while ((lastRowIdx = buffer.lastIndexOf('</Row>')) !== -1 && hasHeaderExtracted) {
          const parseChunk = buffer.substring(0, lastRowIdx + 6);
          buffer = buffer.substring(lastRowIdx + 6);

          const wrappedXml = `<Root><Dataset id="ds_oList">${headerInfoChunk}<Rows>${parseChunk}</Rows></Dataset></Root>`;

          try {
            const res = await this.parseInWorkerFragment(wrappedXml);
            if (res.columns && res.columns.length > 0 && columnNames.length === 0) {
              columnNames = res.columns;
            }
            if (res.parameters && Object.keys(parameters).length === 0) {
              parameters = res.parameters;
            }
            if (res.rows && res.rows.length > 0) {
              for (let i = 0; i < res.rows.length; i++) {
                allRows.push(res.rows[i]);
              }
            }

            if (!isFirstChunkFired && allRows.length >= 100) {
              isFirstChunkFired = true;
              if (onProgress) {
                onProgress(allRows.slice(0, 100), true, false, columnNames);
              }
            }
          } catch (e) {}
        }

        if (done) {
          if (buffer.includes('<Row>') && hasHeaderExtracted) {
            const wrappedXml = `<Root><Dataset id="ds_oList">${headerInfoChunk}<Rows>${buffer}</Rows></Dataset></Root>`;
            try {
              const res = await this.parseInWorkerFragment(wrappedXml);
              if (res.rows && res.rows.length > 0) {
                for (let i = 0; i < res.rows.length; i++) {
                  allRows.push(res.rows[i]);
                }
              }
            } catch (e) {}
          }
          buffer = '';

          if (!isFirstChunkFired && onProgress) {
            onProgress(allRows, true, false, columnNames);
          }

          if (onProgress) {
            onProgress(allRows, false, true, columnNames);
          }

          this.destroy();

          return {
            parameters,
            rows: allRows,
            columns: columnNames,
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