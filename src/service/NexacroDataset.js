/**
 * 넥사크로 Dataset 구조 및 상태 추적 전용 클래스
 * rowType: 0 (Normal), 1 (Insert), 2 (Update), 4 (Delete)
 */
export class NexacroDataset {
  constructor(name = 'ds_output', columns = [], rows = []) {
    this.name = name;
    this.columns = columns;
    this.rows = rows;
    this.position = rows.length > 0 ? 0 : -1;
    this.rowTypes = rows.map(() => 0); // 기본 Normal(0)
    this.orgRows = JSON.parse(JSON.stringify(rows)); // 원본 데이터 보관
  }

  setName(name) {
    this.name = name;
    return this;
  }

  addColumn(id, type = 'string', size = '256') {
    if (!this.columns.some((col) => col.id === id)) {
      this.columns.push({ id, type, size });
    }
    return this;
  }

  getRowCount() {
    return this.rows.length;
  }

  getRow(index) {
    if (index >= 0 && index < this.rows.length) {
      return this.rows[index];
    }
    return null;
  }

  getCurrentRow() {
    return this.getRow(this.position);
  }

  // 넥사크로 표준 컬럼 값 조회 (getColumn)
  getColumn(index, colId) {
    const row = this.getRow(index);
    return row ? row[colId] : undefined;
  }

  // 기존 호환용 단축 메서드
  get(index, colId) {
    return this.getColumn(index, colId);
  }

  // 넥사크로 표준 컬럼 값 설정 (setColumn)
  setColumn(index, colId, value) {
    if (index >= 0 && index < this.rows.length) {
      this.addColumn(colId);

      const orgValue = this.orgRows[index] ? this.orgRows[index][colId] : undefined;
      this.rows[index][colId] = value;

      // 신규 추가(Insert: 1)가 아닌 기존 행의 경우 원본과 비교해 상태 판정
      if (this.rowTypes[index] !== 1) {
        const compOrg = orgValue !== null && orgValue !== undefined ? String(orgValue) : '';
        const compNew = value !== null && value !== undefined ? String(value) : '';

        if (compOrg !== compNew) {
          this.rowTypes[index] = 2; // Update
        } else {
          this.rowTypes[index] = 0; // 원복 시 Normal
        }
      }
      return true;
    }
    return false;
  }

  // 기존 호환용 단축 메서드 (체이닝 유지)
  set(index, colId, value) {
    this.setColumn(index, colId, value);
    return this;
  }

  // 전체 데이터 비우기
  clearData() {
    this.rows = [];
    this.orgRows = [];
    this.rowTypes = [];
    this.position = -1;
    return this;
  }

  addRow(defaultData = {}) {
    const newRow = {};
    this.columns.forEach((col) => {
      newRow[col.id] = defaultData[col.id] !== undefined ? defaultData[col.id] : '';
    });
    Object.keys(defaultData).forEach((key) => {
      newRow[key] = defaultData[key];
      this.addColumn(key);
    });

    this.rows.push(newRow);
    this.orgRows.push(JSON.parse(JSON.stringify(newRow)));
    this.rowTypes.push(1); // Insert
    this.position = this.rows.length - 1;
    return this.position;
  }

  deleteRow(index) {
    if (index >= 0 && index < this.rows.length) {
      this.rowTypes[index] = 4; // Delete
    }
    return this;
  }

  // 변경된 항목이 있는지 확인 (ds.extIsUpdate 대응)
  isUpdated() {
    return this.rowTypes.some((type) => type === 1 || type === 2 || type === 4);
  }

  // 수정/추가/삭제된 행만 추출하여 전송용 Dataset 인스턴스 반환 (ds:U 대응)
  getUpdateDataset(targetName = 'ds_iList') {
    const updatedRows = [];
    const updatedTypes = [];

    this.rows.forEach((row, idx) => {
      const rType = this.rowTypes[idx];
      if (rType === 1 || rType === 2 || rType === 4) {
        updatedRows.push({
          ...row,
          _rowType: rType, // 직렬화 시 <Row type="..."> 판별용
        });
        updatedTypes.push(rType);
      }
    });

    const updateDs = new NexacroDataset(targetName, [...this.columns], updatedRows);
    updateDs.rowTypes = updatedTypes;
    return updateDs;
  }

  // XML 변환을 위한 Plain Object 생성 (RowType 정보 주입)
  toPlainObject() {
    const plainRows = [];

    this.rows.forEach((row, idx) => {
      const rType = this.rowTypes[idx] !== undefined ? this.rowTypes[idx] : 0;
      // 순수 조회 전송 시 삭제된 행은 제외하되, 명시적 삭제 트랜잭션은 포함
      if (rType !== 4 || (rType === 4 && row._rowType === 4)) {
        plainRows.push({
          ...row,
          _rowType: rType, // jsonToNexacroXml에서 <Row type="..."> 태그로 직렬화
        });
      }
    });

    return {
      name: this.name,
      columns: this.columns,
      rows: plainRows,
    };
  }

  // 데이터 로드 시 컬럼이 비어있으면 데이터 키값으로부터 자동 추출
  loadData(rawDatasetData) {
    if (!rawDatasetData) {
      this.clearData();
      return this;
    }

    let targetRows = [];

    if (rawDatasetData instanceof NexacroDataset) {
      this.columns = [...rawDatasetData.columns];
      this.rows = JSON.parse(JSON.stringify(rawDatasetData.rows));
      this.rowTypes = [...rawDatasetData.rowTypes];
      this.orgRows = JSON.parse(JSON.stringify(rawDatasetData.rows));
      this.position = this.rows.length > 0 ? 0 : -1;
      return this;
    }

    if (Array.isArray(rawDatasetData)) {
      targetRows = rawDatasetData;
    } else if (rawDatasetData?.rows) {
      targetRows = rawDatasetData.rows;
      if (rawDatasetData.columns && Array.isArray(rawDatasetData.columns)) {
        this.columns = rawDatasetData.columns;
      }
    }

    this.rows = JSON.parse(JSON.stringify(targetRows));

    // 컬럼 정보가 명시되지 않았다면 첫 번째 행의 키값들을 기반으로 컬럼 자동 생성
    if (this.columns.length === 0 && this.rows.length > 0) {
      Object.keys(this.rows[0]).forEach((key) => {
        if (key !== '_rowType') {
          this.addColumn(key, 'string', '256');
        }
      });
    }

    this.orgRows = JSON.parse(JSON.stringify(this.rows));
    this.rowTypes = this.rows.map(() => 0);
    this.position = this.rows.length > 0 ? 0 : -1;
    return this;
  }
}