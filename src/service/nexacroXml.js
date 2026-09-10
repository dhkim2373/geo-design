// src/service/nexacroXml.js

export function jsonToNexacroXml(parameters = {}, datasets = {}) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Root xmlns="http://www.nexacroplatform.com/platform/dataset">\n';

    // 1. Parameters 직렬화
    xml += '\t<Parameters>\n';
    for (const [key, value] of Object.entries(parameters)) {
        xml += `\t\t<Parameter id="${key}">${escapeXml(value)}</Parameter>\n`;
    }
    xml += '\t</Parameters>\n';

    // 2. Datasets 직렬화
    for (const [dsId, dsData] of Object.entries(datasets)) {
        const { columns = [], rows = [] } = dsData;
        xml += `\t<Dataset id="${dsId}">\n`;
        
        // ColumnInfo 생성
        xml += '\t\t<ColumnInfo>\n';
        columns.forEach(col => {
            xml += `\t\t\t<Column id="${col.id}" type="${col.type || 'string'}" size="${col.size || '256'}"/>\n`;
        });
        xml += '\t\t</ColumnInfo>\n';

        // Rows 생성 (행 상태에 따른 type 속성 부여)
        xml += '\t\t<Rows>\n';
        rows.forEach(row => {
            const rowTypeAttr = getRowTypeAttribute(row._rowType !== undefined ? row._rowType : row.rowType);
            xml += `\t\t\t<Row${rowTypeAttr}>\n`;
            
            columns.forEach(col => {
                const val = row[col.id] !== undefined && row[col.id] !== null ? row[col.id] : '';
                xml += `\t\t\t\t<Col id="${col.id}">${escapeXml(val)}</Col>\n`;
            });
            xml += '\t\t\t</Row>\n';
        });
        xml += '\t\t</Rows>\n';
        xml += `\t</Dataset>\n`;
    }

    xml += '</Root>';
    return xml;
}

export function nexacroXmlToJson(xmlText) {
    if (!xmlText || typeof xmlText !== 'string') {
        return { parameters: {}, datasets: {} };
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    const result = { parameters: {}, datasets: {} };

    // Parameters 역직렬화
    const paramNodes = xmlDoc.querySelectorAll("Parameters > Parameter");
    paramNodes.forEach(node => {
        result.parameters[node.getAttribute("id")] = node.textContent;
    });

    // Datasets 역직렬화
    const datasetNodes = xmlDoc.querySelectorAll("Dataset");
    datasetNodes.forEach(dsNode => {
        const dsId = dsNode.getAttribute("id");
        const columns = [];
        const rows = [];

        dsNode.querySelectorAll("ColumnInfo > Column").forEach(col => {
            columns.push({
                id: col.getAttribute("id"),
                type: col.getAttribute("type"),
                size: col.getAttribute("size")
            });
        });

        dsNode.querySelectorAll("Rows > Row").forEach(row => {
            const rowData = {};
            
            // XML <Row type="..."> 속성 파싱 및 내부 rowType 변환
            const typeAttr = row.getAttribute("type");
            if (typeAttr === 'insert') rowData._rowType = 1;
            else if (typeAttr === 'update') rowData._rowType = 2;
            else if (typeAttr === 'delete') rowData._rowType = 4;
            else rowData._rowType = 0;

            row.querySelectorAll("Col").forEach(colVal => {
                rowData[colVal.getAttribute("id")] = colVal.textContent;
            });
            rows.push(rowData);
        });

        result.datasets[dsId] = { columns, rows };
        // FspClient 및 컴포넌트 하위 호환을 위해 최상위에도 키 할당
        result[dsId] = { columns, rows };
    });

    return result;
}

/**
 * 넥사크로 rowType 숫자 코드를 XML type 속성 문자열로 변환
 * 0: normal(속성 없음), 1: insert, 2: update, 4: delete
 */
function getRowTypeAttribute(rowType) {
    if (rowType === 1 || rowType === 'insert') {
        return ' type="insert"';
    }
    if (rowType === 2 || rowType === 'update') {
        return ' type="update"';
    }
    if (rowType === 4 || rowType === 'delete') {
        return ' type="delete"';
    }
    return '';
}

function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}