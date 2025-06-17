require('dotenv').config();
const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// 더미 Excel 파일 경로
const DUMMY_EXCEL_PATH = path.join(__dirname, '../../data/GRM 더미 데이터.xlsx');

// 스프레드시트의 열 정보 가져오기
router.get('/headers', async (req, res) => {
  console.log('GET /headers 요청 도착');
  
  try {
    // Excel 파일이 존재하는지 확인
    if (!fs.existsSync(DUMMY_EXCEL_PATH)) {
      return res.status(404).json({ message: 'Excel file not found' });
    }

    // Excel 파일 읽기
    const workbook = XLSX.readFile(DUMMY_EXCEL_PATH);
    
    // 첫 번째 시트 이름 가져오기
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 첫 번째 행(헤더) 가져오기
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const headers = jsonData[0] || [];
    
    console.log('Headers from Excel:', headers);
    
    return res.json({ headers, sheetName });
  } catch (error) {
    console.error('Error reading Excel file:', error.message);
    return res.status(500).json({ message: 'Error reading Excel file', error: error.message });
  }
});

// AI 필드 매핑 실행
router.post('/map-fields', async (req, res) => {
  const { headers } = req.body;
  
  if (!headers || !headers.length) {
    return res.status(400).json({ message: 'Headers are required' });
  }

  console.log('POST /map-fields 요청 도착, headers:', headers);

  try {
    // Excel 파일이 존재하는지 확인
    if (!fs.existsSync(DUMMY_EXCEL_PATH)) {
      return res.status(404).json({ message: 'Excel file not found' });
    }

    // Excel 파일 읽기
    const workbook = XLSX.readFile(DUMMY_EXCEL_PATH);
    const originalSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[originalSheetName];
    
    // 전체 데이터를 JSON으로 변환
    const originalData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const originalHeaders = originalData[0] || [];
    const originalRows = originalData.slice(1);
    
    console.log('Original data loaded:', originalRows.length, 'rows');

    // 하드코딩된 매핑 결과 (AI 대신)
    const salesMapping = {
      '고객ID': '고객ID',
      '주문자명': '주문자명', 
      '주문일자': '주문_일자',
      '상품명': '상품명',
      '단가': '단가',
      '수량': '수량',
      '총주문금액': '총_주문_금액',
      '주문상태': '주문_상태'
    };
    
    const customerMapping = {
      '고객ID': '고객ID',
      '주문자명': '고객명',
      '연락처': '연락처',
      '이메일': '이메일'
    };

    // 새로운 시트에 데이터 쓰기 (메모리에서만 처리)
    const salesSheetName = '제품_판매_기록';
    const customerSheetName = '고객_정보';
    
    // 제품 판매 기록 시트 데이터 생성
    const salesData = createSalesSheetData(originalHeaders, originalRows, salesMapping);
    
    // 고객 정보 시트 데이터 생성  
    const customerData = createCustomerSheetData(originalHeaders, originalRows, customerMapping);
    
    // 새로운 워크북 생성
    const newWorkbook = XLSX.utils.book_new();
    
    // 기존 시트 복사
    XLSX.utils.book_append_sheet(newWorkbook, worksheet, originalSheetName);
    
    // 새 시트들 추가
    const salesWorksheet = XLSX.utils.aoa_to_sheet(salesData);
    const customerWorksheet = XLSX.utils.aoa_to_sheet(customerData);
    
    XLSX.utils.book_append_sheet(newWorkbook, salesWorksheet, salesSheetName);
    XLSX.utils.book_append_sheet(newWorkbook, customerWorksheet, customerSheetName);
    
    // 파일로 저장 (임시로 처리된 파일로 저장)
    const processedFilePath = path.join(__dirname, '../temp/processed_data.xlsx');
    
    // temp 디렉토리 확인 및 생성
    const tempDir = path.dirname(processedFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    XLSX.writeFile(newWorkbook, processedFilePath);
    
    console.log('데이터 처리 완료');
    
    res.json({
      salesMapping,
      customerMapping,
      message: '제품 판매 기록 및 고객 정보 시트가 성공적으로 생성되었습니다.',
      salesSheetName,
      customerSheetName,
      salesSheetExists: false,
      customerSheetExists: false
    });
    
  } catch (error) {
    console.error('Error in field mapping process:', error);
    res.status(500).json({ message: 'Error processing Excel file', error: error.message });
  }
});

// 제품 판매 기록 시트 데이터 생성
function createSalesSheetData(originalHeaders, originalRows, salesMapping) {
  // 탄소 배출량 데이터 로드
  const carbonDataPath = path.join(__dirname, '../../data/생활용품 탄소배출량.csv');
  const categoryDataPath = path.join(__dirname, '../../data/카테고리 별 기준 제품.csv');
  
  let productCarbonMap = {};
  let categoryBaseMap = {};
  
  try {
    if (fs.existsSync(carbonDataPath) && fs.existsSync(categoryDataPath)) {
      // CSV 파일 읽기
      const carbonData = fs.readFileSync(carbonDataPath, 'utf8');
      const categoryData = fs.readFileSync(categoryDataPath, 'utf8');
      
      // 제품별 탄소 배출량 맵 생성
      const carbonLines = carbonData.split('\n').slice(1);
      carbonLines.forEach(line => {
        if (line.trim()) {
          const [industry, code, productName, emissionFactor, weightFactor, totalEmission, category] = line.split(',');
          if (productName && emissionFactor && weightFactor) {
            productCarbonMap[productName.trim()] = {
              emissionFactor: parseFloat(emissionFactor.trim()),
              weightFactor: parseFloat(weightFactor.trim()),
              totalEmission: parseFloat(totalEmission.trim()),
              category: category.trim()
            };
          }
        }
      });
      
      // 카테고리별 기준 제품 탄소 배출량 맵 생성
      const categoryLines = categoryData.split('\n').slice(1);
      categoryLines.forEach(line => {
        if (line.trim()) {
          const [category, baseProductName, productCode, baseEmission] = line.split(',');
          if (category && baseEmission) {
            const categoryName = category.trim();
            const baseName = baseProductName.trim();
            if (productCarbonMap[baseName]) {
              categoryBaseMap[categoryName] = {
                emissionFactor: productCarbonMap[baseName].emissionFactor,
                weightFactor: productCarbonMap[baseName].weightFactor,
                totalEmission: productCarbonMap[baseName].totalEmission
              };
            }
          }
        }
      });
      
      console.log(`탄소 배출량 데이터 ${Object.keys(productCarbonMap).length}개 제품 로드 완료`);
    }
  } catch (error) {
    console.error('탄소 배출량 데이터 로드 중 오류:', error);
  }

  // 제품 판매 기록 시트 헤더 정의
  const salesHeaders = [
    '주문_번호', '고객ID', '주문자명', '주문_일자', '거래_완료_일자', 
    '상품명', '단가', '수량', '총_주문_금액', '주문_상태', '제품별_탄소_감축_점수', '총_탄소_감축_점수'
  ];
  
  // 매핑 인덱스 생성
  const mappingIndices = {};
  salesHeaders.forEach(targetField => {
    for (const [originalField, mappedField] of Object.entries(salesMapping)) {
      if (mappedField === targetField) {
        const index = originalHeaders.indexOf(originalField);
        if (index !== -1) {
          mappingIndices[targetField] = index;
        }
        break;
      }
    }
  });
  
  // 데이터 변환
  const salesData = [salesHeaders];
  
  originalRows.forEach((row, rowIndex) => {
    const newRow = salesHeaders.map(targetField => {
      const index = mappingIndices[targetField];
      return index !== undefined ? (row[index] || '') : '';
    });
    
    // 주문_번호 생성 (없는 경우)
    if (!mappingIndices['주문_번호']) {
      const orderNumberIndex = salesHeaders.indexOf('주문_번호');
      newRow[orderNumberIndex] = `ORD${String(rowIndex + 1).padStart(6, '0')}`;
    }
    
    // 거래_완료_일자 생성
    if (!mappingIndices['거래_완료_일자'] && mappingIndices['주문_일자']) {
      const orderDateIndex = salesHeaders.indexOf('주문_일자');
      const completionDateIndex = salesHeaders.indexOf('거래_완료_일자');
      const orderDate = newRow[orderDateIndex];
      
      if (orderDate) {
        try {
          const date = new Date(orderDate);
          date.setDate(date.getDate() + 3);
          newRow[completionDateIndex] = date.toISOString().split('T')[0];
        } catch (e) {
          newRow[completionDateIndex] = '';
        }
      }
    }
    
    // 주문_상태 설정
    if (!mappingIndices['주문_상태']) {
      const statusIndex = salesHeaders.indexOf('주문_상태');
      newRow[statusIndex] = '거래 완료';
    }
    
    // 탄소 감축 점수 계산 (간단한 더미 값)
    const productCarbonIndex = salesHeaders.indexOf('제품별_탄소_감축_점수');
    const totalCarbonIndex = salesHeaders.indexOf('총_탄소_감축_점수');
    
    if (productCarbonIndex !== -1 && totalCarbonIndex !== -1) {
      const dummyScore = Math.random() * 100;
      newRow[productCarbonIndex] = dummyScore.toFixed(2);
      newRow[totalCarbonIndex] = dummyScore.toFixed(2);
    }
    
    salesData.push(newRow);
  });
  
  console.log(`제품 판매 기록 시트 데이터 생성 완료: ${salesData.length - 1}개 행`);
  return salesData;
}

// 고객 정보 시트 데이터 생성
function createCustomerSheetData(originalHeaders, originalRows, customerMapping) {
  // 고객 정보 시트 헤더 정의
  const customerHeaders = [
    '고객ID', '고객명', '연락처', '이메일', '생년월일', '가입일',
    '마지막_구매일', '총_구매_금액', '총_구매_횟수', '탄소_감축_등급', '탄소_감축_점수'
  ];
  
  // 매핑 인덱스 생성
  const mappingIndices = {};
  const basicFields = ['고객ID', '고객명', '연락처', '이메일', '생년월일', '가입일'];
  
  basicFields.forEach(targetField => {
    for (const [originalField, mappedField] of Object.entries(customerMapping)) {
      if (mappedField === targetField) {
        const index = originalHeaders.indexOf(originalField);
        if (index !== -1) {
          mappingIndices[targetField] = index;
        }
        break;
      }
    }
  });
  
  // 고객 데이터 중복 제거 및 변환
  const customerData = [customerHeaders];
  const seenCustomers = new Set();
  
  originalRows.forEach((row, rowIndex) => {
    const customerIdIndex = mappingIndices['고객ID'];
    const customerNameIndex = mappingIndices['고객명'];
    const customerId = customerIdIndex !== undefined ? row[customerIdIndex] : '';
    const customerName = customerNameIndex !== undefined ? row[customerNameIndex] : '';
    
    let customerKey = '';
    if (customerId && customerId.trim() !== '') {
      customerKey = `ID:${customerId.trim()}`;
    } else if (customerName && customerName.trim() !== '') {
      customerKey = `NAME:${customerName.trim()}`;
    } else {
      return;
    }
    
    if (!seenCustomers.has(customerKey)) {
      seenCustomers.add(customerKey);
      
      const newRow = customerHeaders.map(targetField => {
        if (['마지막_구매일', '총_구매_금액', '총_구매_횟수', '탄소_감축_등급', '탄소_감축_점수'].includes(targetField)) {
          // 더미 데이터 생성
          if (targetField === '총_구매_금액') return Math.floor(Math.random() * 500000).toString();
          if (targetField === '총_구매_횟수') return Math.floor(Math.random() * 20 + 1).toString();
          if (targetField === '탄소_감축_등급') return ['Bronze', 'Silver', 'Gold'][Math.floor(Math.random() * 3)];
          if (targetField === '탄소_감축_점수') return (Math.random() * 1000).toFixed(2);
          if (targetField === '마지막_구매일') return new Date().toISOString().split('T')[0];
          return '';
        }
        
        const index = mappingIndices[targetField];
        return index !== undefined ? (row[index] || '') : '';
      });
      
      customerData.push(newRow);
    }
  });
  
  console.log(`고객 정보 시트 데이터 생성 완료: ${customerData.length - 1}명의 고유 고객`);
  return customerData;
}

// 변경 이력 기록 라우트 (더미 처리)
router.post('/record-change', async (req, res) => {
  console.log('record-change 요청 도착 (더미 처리):', req.body);
  
  const { UniqueID, changedBy, changes } = req.body;

  if (!UniqueID || !changedBy || !Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ message: 'UniqueID, changedBy, and changes are required.' });
  }

  try {
    // 더미 처리 - 실제로는 로컬 파일이나 메모리에 저장할 수 있음
    console.log('변경 이력 기록 (더미):', {
      timestamp: new Date().toISOString(),
      userEmail: changedBy,
      uniqueID: UniqueID,
      changes: changes
    });
    
    res.status(200).json({ message: 'Change history recorded successfully (dummy).' });
  } catch (error) {
    console.error('Error recording change history:', error);
    res.status(500).json({ message: 'Failed to record change history.', error: error.message });
  }
});

// 세션 상태 확인용 디버깅 엔드포인트
router.get('/debug-session', (req, res) => {
  console.log('=== 세션 디버깅 정보 ===');
  console.log('req.session.user:', req.session.user);
  console.log('req.sessionID:', req.sessionID);
  console.log('========================');
  
  res.json({
    hasUser: !!(req.session.user),
    user: req.session.user,
    sessionID: req.sessionID
  });
});

module.exports = router; 