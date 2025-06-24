const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// XLSX 파일의 기본 경로 설정
const DEFAULT_EXCEL_PATH = path.join(__dirname, '../data/GRM_주문_데이터.xlsx');

// 디렉토리 생성 함수
const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 기본 XLSX 파일 생성 함수
const createDefaultExcelFile = (filePath) => {
  const workbook = XLSX.utils.book_new();
  
  // 고객_정보 시트 생성
  const customerHeaders = [
    '고객ID', '고객명', '연락처', '이메일', '생년월일', 
    '가입일', '마지막_구매일', '총_구매_금액', '총_구매_횟수', 
    '탄소_감축_등급', '탄소_감축_점수'
  ];
  
  const customerData = [
    customerHeaders,
    ['CUST001', '김철수', '010-1234-5678', 'kim@example.com', '1990-01-01', 
     '2023-01-01', '2024-01-01', '150000', '5', 'Bronze', '1250'],
    ['CUST002', '이영희', '010-9876-5432', 'lee@example.com', '1985-05-15', 
     '2023-02-01', '2024-01-15', '280000', '8', 'Silver', '2100']
  ];
  
  const customerSheet = XLSX.utils.aoa_to_sheet(customerData);
  XLSX.utils.book_append_sheet(workbook, customerSheet, '고객_정보');
  
  // 제품_판매_기록 시트 생성
  const salesHeaders = [
    '주문ID', '고객ID', '제품명', '카테고리', '수량', '단가', 
    '총금액', '주문일', '배송일', '주문상태', '결제방법'
  ];
  
  const salesData = [salesHeaders];
  const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
  XLSX.utils.book_append_sheet(workbook, salesSheet, '제품_판매_기록');
  
  // ChangeHistory 시트 생성
  const historyHeaders = ['Timestamp', 'UserEmail', 'UniqueID', 'FieldName', 'OldValue', 'NewValue'];
  const historyData = [historyHeaders];
  const historySheet = XLSX.utils.aoa_to_sheet(historyData);
  XLSX.utils.book_append_sheet(workbook, historySheet, 'ChangeHistory');
  
  // 파일 저장
  XLSX.writeFile(workbook, filePath);
  console.log(`기본 XLSX 파일이 생성되었습니다: ${filePath}`);
};

// 파일 정보 가져오기
router.get('/file-info', (req, res) => {
  try {
    const filePath = req.query.filePath || DEFAULT_EXCEL_PATH;
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      return res.json({
        success: false,
        message: '파일이 존재하지 않습니다.',
        path: absolutePath,
        exists: false
      });
    }
    
    const stats = fs.statSync(absolutePath);
    const workbook = XLSX.readFile(absolutePath);
    const sheetNames = workbook.SheetNames;
    
    res.json({
      success: true,
      name: path.basename(absolutePath),
      path: absolutePath,
      size: stats.size,
      modified: stats.mtime,
      worksheets: sheetNames.map(name => ({ name })),
      exists: true
    });
  } catch (error) {
    console.error('파일 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '파일 정보를 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 워크시트 목록 가져오기
router.post('/worksheets', (req, res) => {
  try {
    const { filePath } = req.body;
    const resolvedPath = path.resolve(filePath || DEFAULT_EXCEL_PATH);
    
    if (!fs.existsSync(resolvedPath)) {
      ensureDirectoryExists(resolvedPath);
      createDefaultExcelFile(resolvedPath);
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    const sheetNames = workbook.SheetNames;
    
    res.json({
      success: true,
      worksheets: sheetNames.map(name => ({ name }))
    });
  } catch (error) {
    console.error('워크시트 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크시트 목록을 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 워크시트 데이터 가져오기
router.post('/worksheet-data', (req, res) => {
  try {
    const { filePath, sheetName } = req.body;
    const resolvedPath = path.resolve(filePath || DEFAULT_EXCEL_PATH);
    
    if (!fs.existsSync(resolvedPath)) {
      ensureDirectoryExists(resolvedPath);
      createDefaultExcelFile(resolvedPath);
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(404).json({
        success: false,
        message: `워크시트 '${sheetName}'을 찾을 수 없습니다.`
      });
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    res.json({
      success: true,
      data: data,
      rows: data.length,
      columns: data.length > 0 ? data[0].length : 0
    });
  } catch (error) {
    console.error('워크시트 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크시트 데이터를 가져오는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 워크시트 데이터 업데이트
router.put('/worksheet-data', (req, res) => {
  try {
    const { filePath, sheetName, rowIndex, data } = req.body;
    const resolvedPath = path.resolve(filePath || DEFAULT_EXCEL_PATH);
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        message: '파일이 존재하지 않습니다.'
      });
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(404).json({
        success: false,
        message: `워크시트 '${sheetName}'을 찾을 수 없습니다.`
      });
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 행 인덱스 확인
    if (rowIndex < 0 || rowIndex >= existingData.length) {
      return res.status(400).json({
        success: false,
        message: '잘못된 행 인덱스입니다.'
      });
    }
    
    // 데이터 업데이트
    existingData[rowIndex] = data;
    
    // 새 워크시트 생성 및 저장
    const newWorksheet = XLSX.utils.aoa_to_sheet(existingData);
    workbook.Sheets[sheetName] = newWorksheet;
    XLSX.writeFile(workbook, resolvedPath);
    
    res.json({
      success: true,
      message: '데이터가 성공적으로 업데이트되었습니다.',
      updatedRow: rowIndex
    });
  } catch (error) {
    console.error('워크시트 데이터 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 업데이트 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 워크시트에 데이터 추가
router.post('/worksheet-data/append', (req, res) => {
  try {
    const { filePath, sheetName, data } = req.body;
    const resolvedPath = path.resolve(filePath || DEFAULT_EXCEL_PATH);
    
    if (!fs.existsSync(resolvedPath)) {
      ensureDirectoryExists(resolvedPath);
      createDefaultExcelFile(resolvedPath);
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    
    // 시트가 없으면 생성
    if (!workbook.SheetNames.includes(sheetName)) {
      const newWorksheet = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.book_append_sheet(workbook, newWorksheet, sheetName);
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 데이터 추가
    const newData = Array.isArray(data[0]) ? data : [data];
    const updatedData = [...existingData, ...newData];
    
    // 새 워크시트 생성 및 저장
    const newWorksheet = XLSX.utils.aoa_to_sheet(updatedData);
    workbook.Sheets[sheetName] = newWorksheet;
    XLSX.writeFile(workbook, resolvedPath);
    
    res.json({
      success: true,
      message: `${newData.length}개 행이 추가되었습니다.`,
      addedRows: newData.length,
      totalRows: updatedData.length
    });
  } catch (error) {
    console.error('데이터 추가 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 추가 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 워크시트 생성
router.post('/create-worksheet', (req, res) => {
  try {
    const { filePath, sheetName, headers } = req.body;
    const resolvedPath = path.resolve(filePath || DEFAULT_EXCEL_PATH);
    
    if (!fs.existsSync(resolvedPath)) {
      ensureDirectoryExists(resolvedPath);
      createDefaultExcelFile(resolvedPath);
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    
    if (workbook.SheetNames.includes(sheetName)) {
      return res.status(400).json({
        success: false,
        message: `워크시트 '${sheetName}'이 이미 존재합니다.`
      });
    }
    
    const data = headers ? [headers] : [];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, resolvedPath);
    
    res.json({
      success: true,
      message: `워크시트 '${sheetName}'이 생성되었습니다.`
    });
  } catch (error) {
    console.error('워크시트 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크시트 생성 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 워크시트 삭제
router.delete('/worksheet/:name', (req, res) => {
  try {
    const { filePath } = req.body;
    const sheetName = req.params.name;
    const resolvedPath = path.resolve(filePath || DEFAULT_EXCEL_PATH);
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        message: '파일이 존재하지 않습니다.'
      });
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(404).json({
        success: false,
        message: `워크시트 '${sheetName}'을 찾을 수 없습니다.`
      });
    }
    
    // 시트 삭제
    delete workbook.Sheets[sheetName];
    workbook.SheetNames = workbook.SheetNames.filter(name => name !== sheetName);
    
    XLSX.writeFile(workbook, resolvedPath);
    
    res.json({
      success: true,
      message: `워크시트 '${sheetName}'이 삭제되었습니다.`
    });
  } catch (error) {
    console.error('워크시트 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크시트 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 행 삭제
router.delete('/worksheet-data/delete', (req, res) => {
  try {
    const { filePath, sheetName, rowIndex } = req.body;
    const resolvedPath = path.resolve(filePath || DEFAULT_EXCEL_PATH);
    
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        message: '파일이 존재하지 않습니다.'
      });
    }
    
    const workbook = XLSX.readFile(resolvedPath);
    
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(404).json({
        success: false,
        message: `워크시트 '${sheetName}'을 찾을 수 없습니다.`
      });
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 행 인덱스 확인
    if (rowIndex < 0 || rowIndex >= existingData.length) {
      return res.status(400).json({
        success: false,
        message: '잘못된 행 인덱스입니다.'
      });
    }
    
    // 행 삭제
    existingData.splice(rowIndex, 1);
    
    // 새 워크시트 생성 및 저장
    const newWorksheet = XLSX.utils.aoa_to_sheet(existingData);
    workbook.Sheets[sheetName] = newWorksheet;
    XLSX.writeFile(workbook, resolvedPath);
    
    res.json({
      success: true,
      message: '행이 성공적으로 삭제되었습니다.',
      deletedRow: rowIndex,
      remainingRows: existingData.length
    });
  } catch (error) {
    console.error('행 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '행 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 