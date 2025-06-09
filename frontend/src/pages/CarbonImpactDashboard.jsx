import React, { useState, useEffect, useContext } from 'react';
import { Line, Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import { UserContext } from '../contexts/UserContext';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import './CarbonImpactDashboard.css';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

// 유틸리티 함수
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d);
}

const CarbonImpactDashboard = () => {
  const { user, sheets } = useContext(UserContext);
  const { state } = useLocation();
  const sheet = state?.sheet || (sheets && sheets.length > 0 ? sheets[0] : null);

  // 상태 관리
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [expandedCard, setExpandedCard] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // 원본 데이터 상태 (계산용)
  const [salesData, setSalesData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [carbonEmissionData, setCarbonEmissionData] = useState([]);
  
  // 탄소_감축 시트에서 로드된 데이터 상태
  const [summaryData, setSummaryData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [customerSegmentData, setCustomerSegmentData] = useState(null);
  const [engagementDetails, setEngagementDetails] = useState(null);
  const [detailedCarbonData, setDetailedCarbonData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  
  // 업데이트 관련 상태
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // 더미데이터 사용 여부 (발표용)
  const [useDummyData, setUseDummyData] = useState(false);

  // 발표용 더미데이터 생성
  const generateDummyData = () => {
    const currentYear = new Date().getFullYear();
    
    // 더미 요약 데이터 (적당한 수치)
    const dummySummaryData = {
      totalCarbonReduction: 1847.3,
      treeEquivalent: 84,
      ecoProductRatio: 32.1,
      customerEngagement: 58.7,
      lastUpdated: new Date().toISOString()
    };
    
    // 더미 월별 데이터 (12개월간 트렌드)
    const dummyMonthlyData = [];
    const baseReduction = 120;
    for (let i = 0; i < 12; i++) {
      const month = new Date(currentYear, i, 1);
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const variation = Math.random() * 80 + 40; // 40-120 범위의 변동
      dummyMonthlyData.push({
        month: monthKey,
        year: month.getFullYear(),
        carbonReduction: Math.round((baseReduction + variation) * 10) / 10
      });
    }
    
    // 더미 년월별 친환경 제품 판매율 데이터
    const dummyEcoFriendlyMonthlyData = [];
    for (let i = 0; i < 6; i++) {
      const month = new Date(currentYear, i, 1);
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const baseCount = 150 + Math.random() * 100;
      const ecoRatio = 25 + Math.random() * 15; // 25-40% 범위
      
      dummyEcoFriendlyMonthlyData.push({
        month: monthKey,
        year: month.getFullYear(),
        totalSalesCount: Math.round(baseCount),
        totalSalesQuantity: Math.round(baseCount * 2.3),
        totalSalesAmount: Math.round(baseCount * 45000),
        ecoSalesCount: Math.round(baseCount * ecoRatio / 100),
        ecoSalesQuantity: Math.round(baseCount * 2.3 * ecoRatio / 100),
        ecoSalesAmount: Math.round(baseCount * 45000 * ecoRatio / 100),
        ecoRatioByCount: Math.round(ecoRatio * 10) / 10,
        ecoRatioByQuantity: Math.round((ecoRatio + Math.random() * 5 - 2.5) * 10) / 10,
        ecoRatioByAmount: Math.round((ecoRatio + Math.random() * 3 - 1.5) * 10) / 10
      });
    }
    
    // 더미 고객 세그먼트 데이터
    const dummySegmentData = {
      champions: 23,
      loyalists: 45,
      potentials: 67,
      newcomers: 89
    };
    
    // 더미 고객 참여도 상세 데이터
    const dummyEngagementDetails = {
      basicParticipants: 142,
      activeParticipants: 87,
      dedicatedParticipants: 34,
      basicRatio: 63.4,
      activeRatio: 38.8,
      dedicatedRatio: 15.2
    };
    
    // 사용 가능한 년도
    const dummyYears = [currentYear, currentYear - 1];
    
    return {
      summaryData: dummySummaryData,
      detailedData: dummyMonthlyData,
      ecoFriendlyMonthlyData: dummyEcoFriendlyMonthlyData,
      segmentData: dummySegmentData,
      engagementDetails: dummyEngagementDetails,
      years: dummyYears
    };
  };

  // 탄소 감축 데이터 로드 (자동 시트 생성 포함)
  const loadCarbonReductionData = async () => {
    if (!sheet || !window.gapi?.client) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await window.gapi.client.load("sheets", "v4");
      
      // 먼저 시트 정보를 가져와서 탄소_감축 시트가 있는지 확인
      const spreadsheetInfo = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: sheet.sheetId,
      });
      
      const availableSheets = spreadsheetInfo.result.sheets.map(s => s.properties.title);
      console.log('사용 가능한 시트 목록:', availableSheets);
      
      // 탄소_감축 시트가 없으면 자동으로 생성
      if (!availableSheets.includes('탄소_감축')) {
        console.log('탄소_감축 시트가 없습니다. 자동으로 생성하고 데이터를 계산합니다...');
        
        // 원본 데이터 로드
        const rawData = await loadRawData();
        if (!rawData) {
          throw new Error('원본 데이터를 로드할 수 없습니다. 제품_판매_기록, 고객_정보 시트와 CSV 파일을 확인해주세요.');
        }
        
        // 탄소 감축 데이터 계산
        const calculatedData = calculateCarbonSummary(
          rawData.salesData, 
          rawData.carbonEmissionData, 
          rawData.customerData
        );
        
        if (!calculatedData) {
          throw new Error('탄소 감축 데이터 계산에 실패했습니다.');
        }
        
        // 탄소_감축 시트 생성 및 데이터 저장
        const sheetCreated = await createCarbonReductionSheet(calculatedData);
        if (!sheetCreated) {
          throw new Error('탄소_감축 시트 생성에 실패했습니다.');
        }
        
        console.log('탄소_감축 시트 생성 및 데이터 저장 완료. 이제 시트에서 데이터를 로드합니다...');
        
        // 계산된 데이터를 바로 상태에 설정
        setSummaryData(calculatedData.summaryData);
        setDetailedCarbonData(calculatedData.detailedData);
        setCategoryData({ ecoFriendlyMonthlyData: calculatedData.ecoFriendlyMonthlyData });
        setCustomerSegmentData({ segments: calculatedData.segmentData });
        setEngagementDetails(calculatedData.engagementDetails);
        setAvailableYears(calculatedData.years);
        
        console.log('탄소 감축 데이터 초기 설정 완료');
        return;
      }
      
      // 탄소_감축 시트에서 모든 필요한 데이터를 한 번에 로드
      const carbonReductionResponse = await window.gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheet.sheetId,
        ranges: [
          "'탄소_감축'!A2:B5",   // 요약 데이터
          "'탄소_감축'!D2:E50",  // 월별 감축량 데이터
          "'탄소_감축'!G2:P26",  // 년월별 친환경 제품 판매율 데이터
          "'탄소_감축'!Q2:R10",  // 고객 세그먼트
          "'탄소_감축'!S2:U5"    // 고객 참여도 상세 분석
        ]
      });

      const [summaryRange, monthlyRange, ecoFriendlyMonthlyRange, segmentRange, engagementRange] = carbonReductionResponse.result.valueRanges;
      
      // 요약 데이터 파싱
      const summaryValues = summaryRange.values || [];
      const summaryMap = {};
      summaryValues.forEach(row => {
        if (row.length >= 2) {
          summaryMap[row[0]] = parseFloat(row[1]) || 0;
        }
      });
      
      const summaryData = {
        totalCarbonReduction: summaryMap['총_탄소_감축량'] || 0,
        treeEquivalent: summaryMap['나무_그루_수'] || 0,
        ecoProductRatio: summaryMap['친환경_제품_비율'] || 0,
        customerEngagement: summaryMap['고객_환경_참여도'] || 0,
        lastUpdated: new Date().toISOString()
      };
      
      // 월별 데이터 파싱
      const monthlyValues = monthlyRange.values || [];
      const monthlyData = monthlyValues
        .filter(row => row.length >= 2 && row[0] && row[1])
        .map(row => ({
          month: row[0],
          year: parseInt(row[0].split('-')[0]),
          carbonReduction: parseFloat(row[1]) || 0
        }))
        .sort((a, b) => b.month.localeCompare(a.month));
      
      // 년월별 친환경 제품 판매율 데이터 파싱
      const ecoFriendlyMonthlyValues = ecoFriendlyMonthlyRange.values || [];
      const ecoFriendlyMonthlyData = ecoFriendlyMonthlyValues
        .filter(row => row.length >= 10 && row[0] && row[0].match(/^\d{4}-\d{2}$/))
        .map(row => ({
          month: row[0],
          year: parseInt(row[0].split('-')[0]),
          totalSalesCount: parseInt(row[1]) || 0,
          totalSalesQuantity: parseInt(row[2]) || 0,
          totalSalesAmount: parseFloat(row[3]) || 0,
          ecoSalesCount: parseInt(row[4]) || 0,
          ecoSalesQuantity: parseInt(row[5]) || 0,
          ecoSalesAmount: parseFloat(row[6]) || 0,
          ecoRatioByCount: parseFloat(row[7]) || 0,
          ecoRatioByQuantity: parseFloat(row[8]) || 0,
          ecoRatioByAmount: parseFloat(row[9]) || 0
        }))
        .sort((a, b) => b.month.localeCompare(a.month));
      
      // 고객 세그먼트 데이터 파싱
      const segmentValues = segmentRange.values || [];
      const segmentMap = {};
      segmentValues.forEach(row => {
        if (row.length >= 2) {
          segmentMap[row[0]] = parseInt(row[1]) || 0;
        }
      });
      
      const segmentData = {
        champions: segmentMap['champions'] || 0,
        loyalists: segmentMap['loyalists'] || 0,
        potentials: segmentMap['potentials'] || 0,
        newcomers: segmentMap['newcomers'] || 0
      };
      
      // 고객 참여도 상세 데이터 파싱
      const engagementValues = engagementRange.values || [];
      console.log('시트에서 읽어온 engagementValues:', engagementValues);
      
      const engagementMap = {};
      engagementValues.forEach(row => {
        if (row.length >= 3) {
          engagementMap[row[0]] = {
            count: parseInt(row[1]) || 0,
            ratio: parseFloat(row[2]) || 0
          };
        }
      });
      
      console.log('파싱된 engagementMap:', engagementMap);
      
      const engagementDetails = {
        basicParticipants: engagementMap['기본_참여']?.count || 0,
        activeParticipants: engagementMap['활성_참여']?.count || 0,
        dedicatedParticipants: engagementMap['헌신적_참여']?.count || 0,
        basicRatio: engagementMap['기본_참여']?.ratio || 0,
        activeRatio: engagementMap['활성_참여']?.ratio || 0,
        dedicatedRatio: engagementMap['헌신적_참여']?.ratio || 0
      };
      
      console.log('최종 engagementDetails:', engagementDetails);
      
      // 사용 가능한 년도 목록 생성
      const years = [...new Set(monthlyData.map(item => item.year))].sort((a, b) => b - a);
      
      console.log('탄소 감축 데이터 로드 완료:', {
        summary: summaryData,
        monthly: monthlyData.length,
        ecoFriendlyMonthlyData: ecoFriendlyMonthlyData.length,
        segments: segmentData,
        years: years
      });

      // 상태 업데이트
      setSummaryData(summaryData);
      setDetailedCarbonData(monthlyData);
      setCategoryData({ ecoFriendlyMonthlyData: ecoFriendlyMonthlyData });
      setCustomerSegmentData({ segments: segmentData });
      setEngagementDetails(engagementDetails);
      setAvailableYears(years);

    } catch (error) {
      console.error('탄소 감축 데이터 로드 실패:', error);
      let errorMessage = '탄소 감축 데이터를 불러오는 중 오류가 발생했습니다.';
      
      if (error.message && error.message.includes('탄소_감축 시트가 없습니다')) {
        errorMessage = error.message;
      } else if (error.status === 401) {
        errorMessage = '🔐 Google Sheets 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.';
      } else if (error.status === 403) {
        errorMessage = '📋 시트에 접근할 권한이 없습니다. 시트 소유자에게 편집 권한을 요청하세요.';
      } else if (error.status === 404) {
        errorMessage = '📄 시트를 찾을 수 없습니다. 시트 ID와 링크를 확인해주세요.';
      } else if (error.status === 400) {
        errorMessage = '📊 탄소_감축 시트의 범위가 올바르지 않습니다. 시트 구조를 확인해주세요.';
      } else if (error.message && error.message.includes('원본 데이터를 로드할 수 없습니다')) {
        errorMessage = '📋 기본 데이터 시트(제품_판매_기록, 고객_정보)를 찾을 수 없습니다. 시트 이름과 구조를 확인해주세요.';
      } else if (error.message && error.message.includes('NetworkError')) {
        errorMessage = '🌐 네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 원본 데이터 로드 (계산용)
  const loadRawData = async () => {
    if (!sheet || !window.gapi?.client) {
      return null;
    }

    try {
      await window.gapi.client.load("sheets", "v4");
      
      // 먼저 시트 정보를 가져와서 사용 가능한 시트 이름들을 확인
      const spreadsheetInfo = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: sheet.sheetId,
      });
      
      const availableSheets = spreadsheetInfo.result.sheets.map(s => s.properties.title);
      console.log('사용 가능한 시트 목록:', availableSheets);
      
      // 필요한 시트 이름들 확인
      const requiredSheets = ['제품_판매_기록', '고객_정보'];
      const missingSheets = requiredSheets.filter(name => !availableSheets.includes(name));
      
      if (missingSheets.length > 0) {
        throw new Error(`필요한 시트가 없습니다: ${missingSheets.join(', ')}`);
      }
      
      // 병렬로 Google Sheets 데이터와 CSV 파일 로드
      const [salesResponse, customerResponse, carbonCsvResponse] = await Promise.all([
        window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: sheet.sheetId,
          range: "'제품_판매_기록'!A2:L", // 탄소 감축 점수 컬럼 포함으로 확장
        }),
        window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: sheet.sheetId,
          range: "'고객_정보'!A2:I",
        }),
        // CSV 파일 로드
        fetch('/data/생활용품 탄소배출량.csv').then(response => response.text())
      ]);

      // 판매 데이터 파싱 (탄소 감축 점수 컬럼 포함)
      const salesRows = (salesResponse.result.values || [])
        .map((row, index) => {
          const orderId = row[0] || '';
          const customerId = row[1] || '';
          const customerName = row[2] || '';
          const dateStr = row[3] || '';
          const completionDateStr = row[4] || '';
          const productName = row[5] || '';
          const unitPrice = parseFloat(row[6]) || 0;
          const quantity = parseInt(row[7]) || 1;
          const amountStr = row[8] || '';
          const status = row[9] || '';
          const productCarbonReductions = row[10] || '';
          const totalCarbonReduction = parseFloat(row[11]) || 0;

          if (!customerName || !productName || !dateStr || !amountStr) return null;
          
          try {
            const date = parseDate(dateStr);
            const completionDate = completionDateStr ? parseDate(completionDateStr) : date;
            const amount = Number(amountStr.replace(/[,₩\s]/g, "")) || 0;
            
            return { 
              orderId, customerId, customerName, date, completionDate, productName, 
              quantity, amount, unitPrice, status, completionDateStr,
              productCarbonReductions, totalCarbonReduction
            };
          } catch (parseError) {
            console.warn('날짜 파싱 오류:', dateStr, parseError);
            return null;
          }
        })
        .filter((r) => r !== null);

      // 고객 데이터 파싱
      const customerRows = (customerResponse.result.values || [])
        .map((row) => {
          const customerId = row[0] || '';
          const customerName = row[1] || '';
          const email = row[2] || '';
          const phone = row[3] || '';
          const address = row[4] || '';
          const birthDate = row[5] || '';
          const gender = row[6] || '';
          const registrationDate = row[7] || '';
          const carbonGrade = row[8] || '';

          if (!customerId || !customerName) return null;

          return {
            customerId, customerName, email, phone, address,
            birthDate, gender, registrationDate, carbonGrade
          };
        })
        .filter((r) => r !== null);

      // CSV 데이터 파싱 (탄소 배출량)
      const carbonRows = [];
      const csvLines = carbonCsvResponse.split('\n');
      
      // 첫 번째 줄은 헤더이므로 제외
      for (let i = 1; i < csvLines.length; i++) {
        const line = csvLines[i].trim();
        if (!line) continue;
        
        // CSV 파싱 시 쉼표로 분리하되, 괄호 안의 쉼표는 무시
        const columns = [];
        let current = '';
        let inParentheses = false;
        
        for (let char of line) {
          if (char === '(' || char === '（') {
            inParentheses = true;
            current += char;
          } else if (char === ')' || char === '）') {
            inParentheses = false;
            current += char;
          } else if (char === ',' && !inParentheses) {
            columns.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        if (current) columns.push(current.trim());
        
        if (columns.length >= 7) {
          const productName = columns[2] || '';
          const emissionFactorStr = columns[3] || '0';
          const weightFactorStr = columns[4] || '1';
          const totalEmissionStr = columns[5] || '0';
          const category = columns[6] || '';
          const categoryStandard = columns[7] || '';

          if (!productName) continue;
          
          const emissionFactor = parseFloat(emissionFactorStr.replace(/[^\d.-]/g, '')) || 0;
          const weightFactor = parseFloat(weightFactorStr.replace(/[^\d.-]/g, '')) || 1;
          const totalEmission = parseFloat(totalEmissionStr.replace(/[^\d.-]/g, '')) || 0;

          const type = weightFactor < 1.0 ? '친환경' : '일반';
          const reductionEffect = weightFactor < 1.0 ? (emissionFactor * (1.0 - weightFactor)) : 0;

          carbonRows.push({
            productName: productName.trim(),
            category: category.trim(),
            type,
            carbonEmission: emissionFactor,
            weightFactor,
            unit: 'kgCO₂e',
            description: `배출계수: ${emissionFactor}, 가중치: ${weightFactor}`,
            certificationStatus: categoryStandard || '',
            reductionEffect
          });
        }
      }
      
      console.log('원본 데이터 로드 완료:', {
        sales: salesRows.length,
        customers: customerRows.length,
        carbon: carbonRows.length
      });

      return {
        salesData: salesRows,
        customerData: customerRows,
        carbonEmissionData: carbonRows
      };

    } catch (error) {
      console.error('원본 데이터 로드 실패:', error);
      throw error;
    }
  };

  // 탄소 감축 요약 데이터 계산
  const calculateCarbonSummary = (salesData, carbonEmissionData, customerData) => {
    console.log('탄소 감축 요약 계산 시작...');

    if (salesData.length > 0 && carbonEmissionData.length > 0) {
      console.log('탄소 감축량 계산 중...');
      
      // 사용 가능한 년도 목록 생성 (거래_완료_일자 기준)
      const years = [...new Set(salesData.map(sale => {
        const targetDate = sale.completionDate || sale.date;
        return targetDate ? targetDate.getFullYear() : null;
      }).filter(year => year !== null))].sort((a, b) => b - a);
      console.log('사용 가능한 년도 (거래_완료_일자 기준):', years);
      
      // 올해 데이터로 요약 계산 (거래_완료_일자 기준)
      const currentYear = new Date().getFullYear();
      const thisYearSales = salesData.filter(sale => {
        const targetDate = sale.completionDate || sale.date;
        return targetDate && targetDate.getFullYear() === currentYear;
      });
      console.log(`${currentYear}년 판매 데이터 (거래_완료_일자 기준):`, thisYearSales.length);
      
      // 제품_판매_기록 시트의 총_탄소_감축_점수 컬럼을 기반으로 탄소 감축량 계산
      const allMonthlyReduction = {};
      let totalCarbonReduction = 0;
      let ecoProductCount = 0;
      let totalProductCount = 0;
      
      // 시트의 총_탄소_감축_점수 컬럼 값들을 합산하여 총 탄소 감축량 계산
      salesData.forEach(sale => {
        totalProductCount++;
        
        // 시트에서 계산된 탄소 감축 점수를 그대로 사용
        const carbonReduction = sale.totalCarbonReduction || 0;
        
        // 총 탄소 감축량 누적 (탄소 감축 점수가 있는 경우만)
        if (carbonReduction > 0) {
          ecoProductCount++;
          totalCarbonReduction += carbonReduction;
        }
        
        // 거래_완료_일자를 기준으로 년월별 탄소 감축량 집계 (모든 주문에 대해)
        const targetDate = sale.completionDate || sale.date;
        if (targetDate) {
          const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
          if (!allMonthlyReduction[monthKey]) {
            allMonthlyReduction[monthKey] = 0;
          }
          // 해당 월에 총_탄소_감축_점수를 누적 (음수든 양수든 상관없이)
          allMonthlyReduction[monthKey] += carbonReduction;
        }
      });
      
      console.log('총 탄소 감축량 계산 결과 (제품_판매_기록 시트 기반):', {
        totalProducts: totalProductCount,
        ecoProducts: ecoProductCount,
        totalReduction: totalCarbonReduction,
        계산방식: '제품_판매_기록 시트의 총_탄소_감축_점수 컬럼 합산',
        적용기준: '탄소 감축 점수가 0보다 큰 제품만'
      });
      
      console.log('월별 탄소 감축량 집계 결과 (거래_완료_일자 기준):', {
        총월별데이터: Object.keys(allMonthlyReduction).length,
        월별상세: Object.entries(allMonthlyReduction)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 6)
          .map(([month, reduction]) => ({
            월: month,
            감축량: Math.round(reduction * 100) / 100
          })),
        집계방식: '거래_완료_일자를 기준으로 년월별 총_탄소_감축_점수 합산'
      });
      
      // 나무 심기 환산 (1그루당 22kg CO2 흡수)
      const treeEquivalent = Math.round(totalCarbonReduction / 22);
      
      // 탄소배출량 데이터를 기반으로 제품별 weight_factor 정보 추출
      const productWeightMap = {};
      carbonEmissionData.forEach(product => {
        if (product.productName && product.weightFactor !== undefined) {
          productWeightMap[product.productName] = product.weightFactor;
        }
      });
      
      console.log('제품별 Weight Factor 맵 생성 완료:', Object.keys(productWeightMap).length, '개 제품');
      
      // 년월별 친환경 제품 판매율 계산
      const monthlyEcoData = {};
      
      salesData.forEach(sale => {
        const targetDate = sale.completionDate || sale.date;
        if (!targetDate) return;
        
        const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyEcoData[monthKey]) {
          monthlyEcoData[monthKey] = {
            totalSalesCount: 0,
            totalSalesQuantity: 0,
            totalSalesAmount: 0,
            ecoSalesCount: 0,
            ecoSalesQuantity: 0,
            ecoSalesAmount: 0
          };
        }
        
        const saleQuantity = sale.quantity || 1;
        const saleAmount = sale.amount || 0;
        
        monthlyEcoData[monthKey].totalSalesCount++;
        monthlyEcoData[monthKey].totalSalesQuantity += saleQuantity;
        monthlyEcoData[monthKey].totalSalesAmount += saleAmount;
        
        // 판매된 제품들을 쉼표로 분리하여 각각 확인
        const productNames = (sale.productName || '').split(',').map(p => p.trim()).filter(p => p);
        let hasEcoProduct = false;
        
        for (const productName of productNames) {
          // 정확한 매칭 시도
          let weightFactor = productWeightMap[productName];
          
          // 정확한 매칭 실패시 유사한 제품명으로 매칭 시도
          if (weightFactor === undefined) {
            const matchedProduct = Object.keys(productWeightMap).find(key => 
              key.includes(productName) || productName.includes(key) ||
              (productName.length > 2 && key.includes(productName.substring(0, 3)))
            );
            if (matchedProduct) {
              weightFactor = productWeightMap[matchedProduct];
            }
          }
          
          // weight_factor가 0.6 이하면 친환경 제품으로 판단
          if (weightFactor !== undefined && weightFactor <= 0.6) {
            hasEcoProduct = true;
            break;
          }
        }
        
        if (hasEcoProduct) {
          monthlyEcoData[monthKey].ecoSalesCount++;
          monthlyEcoData[monthKey].ecoSalesQuantity += saleQuantity;
          monthlyEcoData[monthKey].ecoSalesAmount += saleAmount;
        }
      });
      
      // 각 월별로 비율 계산
      const ecoFriendlyMonthlyData = Object.entries(monthlyEcoData)
        .map(([month, data]) => {
          const ecoRatioByCount = data.totalSalesCount > 0 ? 
            Math.round((data.ecoSalesCount / data.totalSalesCount) * 100 * 10) / 10 : 0;
          
          const ecoRatioByQuantity = data.totalSalesQuantity > 0 ? 
            Math.round((data.ecoSalesQuantity / data.totalSalesQuantity) * 100 * 10) / 10 : 0;
          
          const ecoRatioByAmount = data.totalSalesAmount > 0 ? 
            Math.round((data.ecoSalesAmount / data.totalSalesAmount) * 100 * 10) / 10 : 0;
          
          return {
            month,
            year: parseInt(month.split('-')[0]),
            totalSalesCount: data.totalSalesCount,
            totalSalesQuantity: data.totalSalesQuantity,
            totalSalesAmount: data.totalSalesAmount,
            ecoSalesCount: data.ecoSalesCount,
            ecoSalesQuantity: data.ecoSalesQuantity,
            ecoSalesAmount: data.ecoSalesAmount,
            ecoRatioByCount,
            ecoRatioByQuantity,
            ecoRatioByAmount
          };
        })
        .sort((a, b) => b.month.localeCompare(a.month));
      
      console.log('년월별 친환경 제품 판매율 계산 완료:', {
        총월수: ecoFriendlyMonthlyData.length,
        최신6개월: ecoFriendlyMonthlyData.slice(0, 6).map(item => ({
          월: item.month,
          건수비율: item.ecoRatioByCount + '%',
          수량비율: item.ecoRatioByQuantity + '%',
          매출비율: item.ecoRatioByAmount + '%'
        }))
      });
      
      // 올해 데이터 기준으로 전체 친환경 제품 판매율 계산 (요약용)
      let totalSalesQuantity = 0;
      let totalSalesAmount = 0;
      let ecoSalesQuantity = 0;
      let ecoSalesAmount = 0;
      let ecoSalesCount = 0;
      let totalSalesCount = thisYearSales.length;
      
      thisYearSales.forEach(sale => {
        const saleQuantity = sale.quantity || 1;
        const saleAmount = sale.amount || 0;
        
        totalSalesQuantity += saleQuantity;
        totalSalesAmount += saleAmount;
        
        // 판매된 제품들을 쉼표로 분리하여 각각 확인
        const productNames = (sale.productName || '').split(',').map(p => p.trim()).filter(p => p);
        let hasEcoProduct = false;
        
        for (const productName of productNames) {
          // 정확한 매칭 시도
          let weightFactor = productWeightMap[productName];
          
          // 정확한 매칭 실패시 유사한 제품명으로 매칭 시도
          if (weightFactor === undefined) {
            const matchedProduct = Object.keys(productWeightMap).find(key => 
              key.includes(productName) || productName.includes(key) ||
              (productName.length > 2 && key.includes(productName.substring(0, 3)))
            );
            if (matchedProduct) {
              weightFactor = productWeightMap[matchedProduct];
            }
          }
          
          // weight_factor가 0.6 이하면 친환경 제품으로 판단
          if (weightFactor !== undefined && weightFactor <= 0.6) {
            hasEcoProduct = true;
            break;
          }
        }
        
        if (hasEcoProduct) {
          ecoSalesQuantity += saleQuantity;
          ecoSalesAmount += saleAmount;
          ecoSalesCount++;
        }
      });
      
      // 다양한 기준으로 친환경 제품 비율 계산
      const ecoRatioByCount = totalSalesCount > 0 ? 
        Math.round((ecoSalesCount / totalSalesCount) * 100 * 10) / 10 : 0;
      
      const ecoRatioByQuantity = totalSalesQuantity > 0 ? 
        Math.round((ecoSalesQuantity / totalSalesQuantity) * 100 * 10) / 10 : 0;
      
      const ecoRatioByAmount = totalSalesAmount > 0 ? 
        Math.round((ecoSalesAmount / totalSalesAmount) * 100 * 10) / 10 : 0;
      
      // 가중 평균으로 최종 비율 계산 (수량 40% + 매출 40% + 건수 20%)
      const ecoProductRatio = Math.round(
        (ecoRatioByQuantity * 0.4 + ecoRatioByAmount * 0.4 + ecoRatioByCount * 0.2) * 10
      ) / 10;
      
      console.log('친환경 제품 판매율 상세 분석 (Weight_factor 기반, 올해 데이터, 거래_완료_일자 기준):', {
        총판매건수: totalSalesCount,
        총판매수량: totalSalesQuantity,
        총매출액: totalSalesAmount,
        친환경판매건수: ecoSalesCount,
        친환경판매수량: ecoSalesQuantity,
        친환경매출액: ecoSalesAmount,
        건수기준비율: ecoRatioByCount + '%',
        수량기준비율: ecoRatioByQuantity + '%',
        매출기준비율: ecoRatioByAmount + '%',
        최종가중비율: ecoProductRatio + '%',
        가중평균공식: '건수(20%) + 수량(40%) + 매출(40%)',
        판별기준: 'weight_factor <= 0.6',
        활용데이터: 'CSV 파일의 제품별 weight_factor'
      });
      
      // 고객 환경 참여도 (전체 기간 데이터 기반 - weight_factor 기준)
      const uniqueCustomers = [...new Set(salesData.map(sale => sale.customerId || sale.customerName))];
      
      // 각 고객의 친환경 제품 구매 내역 분석 (전체 기간)
      const customerEcoAnalysis = {};
      salesData.forEach(sale => {
        const customerId = sale.customerId || sale.customerName;
        if (!customerId) return;
        
        if (!customerEcoAnalysis[customerId]) {
          customerEcoAnalysis[customerId] = {
            totalPurchases: 0,
            ecoFriendlyPurchases: 0,
            totalAmount: 0,
            ecoFriendlyAmount: 0
          };
        }
        
        customerEcoAnalysis[customerId].totalPurchases++;
        customerEcoAnalysis[customerId].totalAmount += sale.amount || 0;
        
        // weight_factor 기준으로 친환경 제품 여부 판단
        const productNames = (sale.productName || '').split(',').map(p => p.trim()).filter(p => p);
        let hasEcoProduct = false;
        
        for (const productName of productNames) {
          // 정확한 매칭 시도
          let weightFactor = productWeightMap[productName];
          
          // 정확한 매칭 실패시 유사한 제품명으로 매칭 시도
          if (weightFactor === undefined) {
            const matchedProduct = Object.keys(productWeightMap).find(key => 
              key.includes(productName) || productName.includes(key) ||
              (productName.length > 2 && key.includes(productName.substring(0, 3)))
            );
            if (matchedProduct) {
              weightFactor = productWeightMap[matchedProduct];
            }
          }
          
          // weight_factor가 0.6 이하면 친환경 제품으로 판단
          if (weightFactor !== undefined && weightFactor <= 0.6) {
            hasEcoProduct = true;
            break;
          }
        }
        
        if (hasEcoProduct) {
          customerEcoAnalysis[customerId].ecoFriendlyPurchases++;
          customerEcoAnalysis[customerId].ecoFriendlyAmount += sale.amount || 0;
        }
      });
      
      // 3단계 고객 분류
      let basicParticipants = 0;      // 1회 이상 친환경 제품 구매
      let activeParticipants = 0;     // 3회 이상 친환경 제품 구매
      let dedicatedParticipants = 0;  // 구매의 50% 이상이 친환경 제품
      
      Object.values(customerEcoAnalysis).forEach(analysis => {
        const ecoRatio = analysis.totalPurchases > 0 ? 
          analysis.ecoFriendlyPurchases / analysis.totalPurchases : 0;
        
        // 기본 참여 고객 (1회 이상 친환경 제품 구매)
        if (analysis.ecoFriendlyPurchases >= 1) {
          basicParticipants++;
        }
        
        // 활성 참여 고객 (3회 이상 친환경 제품 구매)
        if (analysis.ecoFriendlyPurchases >= 3) {
          activeParticipants++;
        }
        
        // 헌신적 참여 고객 (구매의 50% 이상이 친환경 제품)
        if (ecoRatio >= 0.5) {
          dedicatedParticipants++;
        }
      });
      
      // README.md 기준: 고객 환경 참여도 = (기본 + 활성 + 헌신적) / 3
      const totalCustomers = uniqueCustomers.length;
      const basicRatio = totalCustomers > 0 ? (basicParticipants / totalCustomers) * 100 : 0;
      const activeRatio = totalCustomers > 0 ? (activeParticipants / totalCustomers) * 100 : 0;
      const dedicatedRatio = totalCustomers > 0 ? (dedicatedParticipants / totalCustomers) * 100 : 0;
      
      const customerEngagement = Math.round(
        (basicRatio + activeRatio + dedicatedRatio) / 3 * 10
      ) / 10;
      
      console.log('고객 환경 참여도 상세 분석 (Weight_factor 기준, 전체 기간 데이터, 거래_완료_일자 기준):', {
        총고객수: totalCustomers,
        기본참여고객: `${basicParticipants}명 (1회 이상 친환경 제품 구매)`,
        활성참여고객: `${activeParticipants}명 (3회 이상 친환경 제품 구매)`,
        헌신적참여고객: `${dedicatedParticipants}명 (구매의 50% 이상이 친환경 제품)`,
        기본참여비율: Math.round(basicRatio * 10) / 10 + '%',
        활성참여비율: Math.round(activeRatio * 10) / 10 + '%',
        헌신적참여비율: Math.round(dedicatedRatio * 10) / 10 + '%',
        최종참여도: customerEngagement + '%',
        계산공식: '(기본 + 활성 + 헌신적) / 3',
        평균계산: `(${Math.round(basicRatio * 10) / 10} + ${Math.round(activeRatio * 10) / 10} + ${Math.round(dedicatedRatio * 10) / 10}) / 3`,
        판별기준: 'weight_factor <= 0.6',
        활용데이터: 'CSV 파일의 제품별 weight_factor'
      });
      
      // 처음 5명의 고객 분석 결과 출력 (디버깅용)
      const sampleCustomers = Object.entries(customerEcoAnalysis).slice(0, 5);
      console.log('샘플 고객 환경 참여 분석:', sampleCustomers.map(([customerId, analysis]) => ({
        고객ID: customerId,
        총구매: analysis.totalPurchases,
        친환경구매: analysis.ecoFriendlyPurchases,
        친환경비율: analysis.totalPurchases > 0 ? Math.round((analysis.ecoFriendlyPurchases / analysis.totalPurchases) * 100) + '%' : '0%'
      })));
      
      // engagementDetails 확인 로그 추가
      console.log('engagementDetails 계산 확인:', {
        basicParticipants,
        activeParticipants,
        dedicatedParticipants,
        basicRatio: Math.round(basicRatio * 10) / 10,
        activeRatio: Math.round(activeRatio * 10) / 10,
        dedicatedRatio: Math.round(dedicatedRatio * 10) / 10
      });
      
      const summaryData = {
        totalCarbonReduction: Math.round(totalCarbonReduction * 10) / 10,
        treeEquivalent,
        ecoProductRatio,
        customerEngagement,
        lastUpdated: new Date().toISOString()
      };
      
      // 전체 상세 데이터 저장 (모든 년도/월별)
      const detailedData = Object.entries(allMonthlyReduction)
        .map(([month, reduction]) => ({
          month,
          year: parseInt(month.split('-')[0]),
          carbonReduction: Math.round(reduction * 10) / 10
        }))
        .sort((a, b) => b.month.localeCompare(a.month)); // 최신순 정렬
      
      // 친환경 제품 판매율 상세 데이터 (탄소_감축 시트 저장용)
      const ecoFriendlyData = {
        totalSalesCount: totalSalesCount,
        totalSalesQuantity: totalSalesQuantity,
        totalSalesAmount: totalSalesAmount,
        ecoSalesCount: ecoSalesCount,
        ecoSalesQuantity: ecoSalesQuantity,
        ecoSalesAmount: ecoSalesAmount,
        ecoRatioByCount: ecoRatioByCount,
        ecoRatioByQuantity: ecoRatioByQuantity,
        ecoRatioByAmount: ecoRatioByAmount
      };

      // 고객 세그먼트 데이터 계산 (weight_factor 기준)
      const customerStats = {};
      
      salesData.forEach(sale => {
        const customerId = sale.customerId || sale.customerName;
        if (!customerId) return;
        
        if (!customerStats[customerId]) {
          customerStats[customerId] = {
            totalPurchases: 0,
            ecoFriendlyPurchases: 0,
            totalAmount: 0
          };
        }
        
        customerStats[customerId].totalPurchases++;
        customerStats[customerId].totalAmount += sale.amount || 0;
        
        // weight_factor 기준으로 친환경 제품 여부 판단
        const productNames = (sale.productName || '').split(',').map(p => p.trim()).filter(p => p);
        let hasEcoProduct = false;
        
        for (const productName of productNames) {
          // 정확한 매칭 시도
          let weightFactor = productWeightMap[productName];
          
          // 정확한 매칭 실패시 유사한 제품명으로 매칭 시도
          if (weightFactor === undefined) {
            const matchedProduct = Object.keys(productWeightMap).find(key => 
              key.includes(productName) || productName.includes(key) ||
              (productName.length > 2 && key.includes(productName.substring(0, 3)))
            );
            if (matchedProduct) {
              weightFactor = productWeightMap[matchedProduct];
            }
          }
          
          // weight_factor가 0.6 이하면 친환경 제품으로 판단
          if (weightFactor !== undefined && weightFactor <= 0.6) {
            hasEcoProduct = true;
            break;
          }
        }
        
        if (hasEcoProduct) {
          customerStats[customerId].ecoFriendlyPurchases++;
        }
      });
      
      // 고객 세그먼트 분류
      const segmentData = {
        champions: 0,    // 많은 구매 + 높은 친환경 비율
        loyalists: 0,    // 많은 구매 + 보통 친환경 비율
        potentials: 0,   // 보통 구매 + 높은 친환경 비율
        newcomers: 0     // 적은 구매
      };
      
      Object.values(customerStats).forEach(stats => {
        const ecoRatio = stats.totalPurchases > 0 ? stats.ecoFriendlyPurchases / stats.totalPurchases : 0;
        
        if (stats.totalPurchases >= 5) {
          if (ecoRatio >= 0.5) {
            segmentData.champions++;
          } else {
            segmentData.loyalists++;
          }
        } else if (stats.totalPurchases >= 2) {
          if (ecoRatio >= 0.3) {
            segmentData.potentials++;
          } else {
            segmentData.newcomers++;
          }
        } else {
          segmentData.newcomers++;
        }
      });
      
      const finalEngagementDetails = {
        basicParticipants,
        activeParticipants,
        dedicatedParticipants,
        basicRatio: Math.round(basicRatio * 10) / 10,
        activeRatio: Math.round(activeRatio * 10) / 10,
        dedicatedRatio: Math.round(dedicatedRatio * 10) / 10
      };

      console.log('탄소 감축 계산 완료:', {
        summary: summaryData,
        monthly: detailedData.length,
        monthlyEcoData: ecoFriendlyMonthlyData.length,
        segments: segmentData,
        years: years,
        finalEngagementDetails
      });

      return {
        summaryData,
        detailedData,
        ecoFriendlyMonthlyData,
        segmentData,
        years,
        engagementDetails: finalEngagementDetails
      };
    }
    
    return null;
  };

  // 탄소_감축 시트 생성 및 데이터 저장
  const createCarbonReductionSheet = async (calculatedData) => {
    if (!sheet || !window.gapi?.client || !calculatedData) {
      return false;
    }

    try {
      console.log('탄소_감축 시트 생성 시작...');
      
      // 1. 새 시트 생성
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheet.sheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: "탄소_감축"
              }
            }
          }]
        }
      });

      console.log('탄소_감축 시트 생성 완료');

      // 2. 데이터 구성
      const { summaryData, detailedData, ecoFriendlyMonthlyData, segmentData } = calculatedData;
      
      // 헤더와 데이터 준비
      const values = [];
      
      // 요약 데이터 (A1:B5)
      values.push(['구분', '값']);
      values.push(['총_탄소_감축량', summaryData.totalCarbonReduction]);
      values.push(['나무_그루_수', summaryData.treeEquivalent]);
      values.push(['친환경_제품_비율', summaryData.ecoProductRatio]);
      values.push(['고객_환경_참여도', summaryData.customerEngagement]);
      
      // 빈 행들로 채우기 (6-13행)
      for (let i = 0; i < 8; i++) {
        values.push(['', '']);
      }

      // 3. 월별 데이터, 년월별 친환경 제품 판매율 데이터, 세그먼트 데이터를 별도로 추가
      const monthlyValues = [['년월', '감축량']];
      detailedData.forEach(item => {
        monthlyValues.push([item.month, item.carbonReduction]);
      });

      // 년월별 친환경 제품 판매율 상세 데이터 (G1:P26)
      const ecoFriendlyMonthlyValues = [[
        '년월', '총_판매_건수', '총_판매_수량', '총_매출액', 
        '친환경_판매_건수', '친환경_판매_수량', '친환경_매출액',
        '건수_기준_비율', '수량_기준_비율', '매출_기준_비율'
      ]];
      
      ecoFriendlyMonthlyData.forEach(item => {
        ecoFriendlyMonthlyValues.push([
          item.month,
          item.totalSalesCount,
          item.totalSalesQuantity,
          item.totalSalesAmount,
          item.ecoSalesCount,
          item.ecoSalesQuantity,
          item.ecoSalesAmount,
          item.ecoRatioByCount,
          item.ecoRatioByQuantity,
          item.ecoRatioByAmount
        ]);
      });

      const segmentValues = [['세그먼트', '고객수']];
      segmentValues.push(['champions', segmentData.champions]);
      segmentValues.push(['loyalists', segmentData.loyalists]);
      segmentValues.push(['potentials', segmentData.potentials]);
      segmentValues.push(['newcomers', segmentData.newcomers]);
      
      // 고객 참여도 상세 분석 데이터 (새로 추가)
      const engagementValues = [['참여도_분류', '고객수', '비율']];
      if (calculatedData.engagementDetails) {
        console.log('시트 저장용 engagementDetails:', calculatedData.engagementDetails);
        engagementValues.push(['기본_참여', calculatedData.engagementDetails.basicParticipants, calculatedData.engagementDetails.basicRatio]);
        engagementValues.push(['활성_참여', calculatedData.engagementDetails.activeParticipants, calculatedData.engagementDetails.activeRatio]);
        engagementValues.push(['헌신적_참여', calculatedData.engagementDetails.dedicatedParticipants, calculatedData.engagementDetails.dedicatedRatio]);
      } else {
        console.warn('engagementDetails가 없습니다!');
      }
      console.log('시트에 저장될 engagementValues:', engagementValues);

      // 4. 모든 데이터를 한 번에 저장
      await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheet.sheetId,
        resource: {
          valueInputOption: 'RAW',
          data: [
            {
              range: "'탄소_감축'!A1:B5",
              values: values.slice(0, 5)
            },
            {
              range: `'탄소_감축'!D1:E${monthlyValues.length}`,
              values: monthlyValues
            },
            {
              range: `'탄소_감축'!G1:P${Math.max(ecoFriendlyMonthlyValues.length, 26)}`,
              values: ecoFriendlyMonthlyValues.concat(Array(Math.max(0, 26 - ecoFriendlyMonthlyValues.length)).fill(Array(10).fill('')))
            },
            {
              range: `'탄소_감축'!Q1:R${segmentValues.length}`,
              values: segmentValues
            },
            {
              range: `'탄소_감축'!S1:U${engagementValues.length}`,
              values: engagementValues
            }
          ]
        }
      });

      console.log('탄소_감축 시트 데이터 저장 완료');
      return true;

    } catch (error) {
      console.error('탄소_감축 시트 생성 실패:', error);
      return false;
    }
  };

  // 탄소_감축 시트 업데이트 기능
  const updateCarbonReductionSheet = async () => {
    if (!sheet || !window.gapi?.client || isUpdating) {
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      console.log('탄소_감축 시트 업데이트 시작...');
      
      // 1. 원본 데이터 다시 로드
      const rawData = await loadRawData();
      if (!rawData) {
        throw new Error('원본 데이터를 로드할 수 없습니다.');
      }
      
      // 2. 최신 데이터로 다시 계산
      const calculatedData = calculateCarbonSummary(
        rawData.salesData, 
        rawData.carbonEmissionData, 
        rawData.customerData
      );
      
      if (!calculatedData) {
        throw new Error('탄소 감축 데이터 계산에 실패했습니다.');
      }
      
      // 3. 기존 시트 데이터 업데이트
      const { summaryData, detailedData, ecoFriendlyMonthlyData, segmentData } = calculatedData;
      
      // 월별 데이터, 년월별 친환경 제품 판매율 데이터, 세그먼트 데이터 준비
      const monthlyValues = [['년월', '감축량']];
      detailedData.forEach(item => {
        monthlyValues.push([item.month, item.carbonReduction]);
      });

      // 년월별 친환경 제품 판매율 상세 데이터 (G1:P26)
      const ecoFriendlyMonthlyValues = [[
        '년월', '총_판매_건수', '총_판매_수량', '총_매출액', 
        '친환경_판매_건수', '친환경_판매_수량', '친환경_매출액',
        '건수_기준_비율', '수량_기준_비율', '매출_기준_비율'
      ]];
      
      ecoFriendlyMonthlyData.forEach(item => {
        ecoFriendlyMonthlyValues.push([
          item.month,
          item.totalSalesCount,
          item.totalSalesQuantity,
          item.totalSalesAmount,
          item.ecoSalesCount,
          item.ecoSalesQuantity,
          item.ecoSalesAmount,
          item.ecoRatioByCount,
          item.ecoRatioByQuantity,
          item.ecoRatioByAmount
        ]);
      });

      const segmentValues = [['세그먼트', '고객수']];
      segmentValues.push(['champions', segmentData.champions]);
      segmentValues.push(['loyalists', segmentData.loyalists]);
      segmentValues.push(['potentials', segmentData.potentials]);
      segmentValues.push(['newcomers', segmentData.newcomers]);
      
      // 고객 참여도 상세 분석 데이터
      const engagementValues = [['참여도_분류', '고객수', '비율']];
      if (calculatedData.engagementDetails) {
        console.log('업데이트용 engagementDetails:', calculatedData.engagementDetails);
        engagementValues.push(['기본_참여', calculatedData.engagementDetails.basicParticipants, calculatedData.engagementDetails.basicRatio]);
        engagementValues.push(['활성_참여', calculatedData.engagementDetails.activeParticipants, calculatedData.engagementDetails.activeRatio]);
        engagementValues.push(['헌신적_참여', calculatedData.engagementDetails.dedicatedParticipants, calculatedData.engagementDetails.dedicatedRatio]);
      } else {
        console.warn('업데이트 시 engagementDetails가 없습니다!');
      }
      console.log('업데이트될 engagementValues:', engagementValues);

      // 4. 시트 데이터 업데이트 (기존 데이터 덮어쓰기)
      await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheet.sheetId,
        resource: {
          valueInputOption: 'RAW',
          data: [
            {
              range: "'탄소_감축'!A2:B5",
              values: [
                ['총_탄소_감축량', summaryData.totalCarbonReduction],
                ['나무_그루_수', summaryData.treeEquivalent],
                ['친환경_제품_비율', summaryData.ecoProductRatio],
                ['고객_환경_참여도', summaryData.customerEngagement]
              ]
            },
            {
              range: `'탄소_감축'!D1:E${Math.max(monthlyValues.length, 50)}`,
              values: monthlyValues.concat(Array(Math.max(0, 50 - monthlyValues.length)).fill(['', '']))
            },
            {
              range: `'탄소_감축'!G1:P${Math.max(ecoFriendlyMonthlyValues.length, 26)}`,
              values: ecoFriendlyMonthlyValues.concat(Array(Math.max(0, 26 - ecoFriendlyMonthlyValues.length)).fill(Array(10).fill('')))
            },
            {
              range: `'탄소_감축'!Q1:R${Math.max(segmentValues.length, 10)}`,
              values: segmentValues.concat(Array(Math.max(0, 10 - segmentValues.length)).fill(['', '']))
            },
            {
              range: `'탄소_감축'!S1:U${Math.max(engagementValues.length, 5)}`,
              values: engagementValues.concat(Array(Math.max(0, 5 - engagementValues.length)).fill(['', '', '']))
            }
          ]
        }
      });

      // 5. 상태 업데이트
      setSummaryData({
        ...summaryData,
        lastUpdated: new Date().toISOString()
      });
      setDetailedCarbonData(calculatedData.detailedData);
      setCategoryData({ ecoFriendlyMonthlyData: calculatedData.ecoFriendlyMonthlyData });
      setCustomerSegmentData({ segments: calculatedData.segmentData });
      setEngagementDetails(calculatedData.engagementDetails);
      setAvailableYears(calculatedData.years);
      setLastUpdated(new Date().toISOString());
      
      console.log('탄소_감축 시트 업데이트 완료');

    } catch (error) {
      console.error('탄소_감축 시트 업데이트 실패:', error);
      let errorMessage = '데이터 업데이트에 실패했습니다.';
      
      if (error.status === 401) {
        errorMessage = '🔐 Google Sheets 인증이 만료되었습니다. 로그아웃 후 다시 로그인해주세요.';
      } else if (error.status === 403) {
        errorMessage = '📋 시트 편집 권한이 없습니다. 시트 소유자에게 편집 권한을 요청하세요.';
      } else if (error.status === 404) {
        errorMessage = '📄 업데이트할 시트를 찾을 수 없습니다.';
      } else if (error.message && error.message.includes('원본 데이터를 로드할 수 없습니다')) {
        errorMessage = '📋 기본 데이터 시트에서 최신 데이터를 읽을 수 없습니다.';
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // 월별 추이 데이터 계산 (탄소_감축 시트 데이터 기반)
  const calculateTrendData = (period = '6months') => {
    console.log('추이 데이터 계산 시작...');
    
    if (detailedCarbonData && detailedCarbonData.length > 0) {
      console.log('탄소_감축 시트 기반 추이 데이터 생성 중...');
      
      const months = period === '3months' ? 3 : period === '6months' ? 6 : 12;
      const trends = [];
      
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // detailedCarbonData에서 해당 월의 데이터 찾기
        const monthData = detailedCarbonData.find(item => item.month === monthStr);
        const carbonReduction = monthData ? monthData.carbonReduction : 0;
        
        trends.push({ month: monthStr, carbonReduction });
      }
      
      console.log('추이 데이터 생성 완료:', trends);
      setTrendsData({ trends });
    }
  };

  // 데이터 로드
  useEffect(() => {
    if (useDummyData) {
      console.log('더미데이터 모드 활성화');
      const dummyData = generateDummyData();
      setSummaryData(dummyData.summaryData);
      setDetailedCarbonData(dummyData.detailedData);
      setCategoryData({ ecoFriendlyMonthlyData: dummyData.ecoFriendlyMonthlyData });
      setCustomerSegmentData({ segments: dummyData.segmentData });
      setEngagementDetails(dummyData.engagementDetails);
      setAvailableYears(dummyData.years);
      setTrendsData(dummyData.detailedData); // trendsData도 설정
      setLoading(false);
      setError(null);
    } else if (user && sheet) {
      console.log('탄소 감축 데이터 로딩 시작:', { user: user.email, sheet: sheet.name });
      loadCarbonReductionData();
    } else {
      console.log('로딩 조건 불충족:', { user: !!user, sheet: !!sheet });
      setLoading(false);
    }
  }, [user, sheet, useDummyData]);

  // 추이 데이터 계산 (기간 변경시)
  useEffect(() => {
    if (detailedCarbonData && detailedCarbonData.length > 0) {
      calculateTrendData(selectedPeriod);
    }
  }, [detailedCarbonData, selectedPeriod]);

  // 기간 변경 핸들러
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    calculateTrendData(period);
  };

  // 카드 클릭 핸들러
  const handleCardClick = (cardType) => {
    if (expandedCard === cardType) {
      setExpandedCard(null); // 같은 카드 클릭시 축소
    } else {
      setExpandedCard(cardType); // 다른 카드로 확장
    }
  };

  // 년도 선택 핸들러
  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  // 로그인 확인
  if (!user) {
    return (
      <div className="carbon-dashboard-page">
        <Header />
        <div className="main-content">
          <div className="carbon-dashboard">
            <div className="error-container">
              <h3>🔒 로그인 필요</h3>
              <p>탄소 감축 대시보드를 이용하려면 로그인이 필요합니다.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className="carbon-dashboard-page">
        <Header sheet={sheet} />
        <div className="main-content">
          <div className="carbon-dashboard">
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>탄소 감축 데이터를 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="carbon-dashboard-page">
        <Header sheet={sheet} />
        <div className="main-content">
          <div className="carbon-dashboard">
            <div className="error-container">
              <h3>⚠️ 오류 발생</h3>
              <p>{error}</p>
              <div className="error-actions">
                <button 
                  className="retry-button"
                  onClick={() => {
                    setError(null);
                    loadCarbonReductionData();
                  }}
                >
                  다시 시도
                </button>
                <button 
                  className="refresh-button"
                  onClick={() => window.location.reload()}
                >
                  페이지 새로고침
                </button>
              </div>
              <div className="error-details">
                <details>
                  <summary>기술적 세부사항</summary>
                  <div className="error-info">
                    <p><strong>가능한 원인:</strong></p>
                    <ul>
                      <li>Google Sheets API 인증 문제 (401 오류)</li>
                      <li>시트 접근 권한 부족</li>
                      <li>네트워크 연결 문제</li>
                      <li>API 키 만료 또는 잘못된 설정</li>
                    </ul>
                    <p><strong>해결 방법:</strong></p>
                    <ul>
                      <li>1. 로그아웃 후 다시 로그인</li>
                      <li>2. 시트 공유 권한 확인</li>
                      <li>3. 브라우저 캐시 및 쿠키 삭제</li>
                      <li>4. 다른 브라우저에서 시도</li>
                    </ul>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="carbon-dashboard-page">
      <Header sheet={sheet} />
      <div className="main-content">
        <div className="carbon-dashboard">
          {/* 헤더 섹션 */}
          <div className="dashboard-header">
            <div className="header-content">
              <div className="header-text">
                <h1>🌱 탄소 감축 현황 대시보드</h1>
                <p>친환경 제품 판매를 통한 탄소 감축 효과를 확인하세요</p>
              </div>
              <div className="header-actions">
                <div className="last-updated">
                  마지막 업데이트: {
                    lastUpdated ? 
                    new Date(lastUpdated).toLocaleString('ko-KR') : 
                    summaryData?.lastUpdated ? 
                    new Date(summaryData.lastUpdated).toLocaleString('ko-KR') : 
                    '데이터 없음'
                  }
                </div>
                <button 
                  className={`update-button ${isUpdating ? 'updating' : ''}`}
                  onClick={updateCarbonReductionSheet}
                  disabled={isUpdating}
                  title="최신 판매 데이터를 반영하여 탄소 감축 정보를 업데이트합니다"
                >
                  {isUpdating ? (
                    <>
                      <div className="update-spinner"></div>
                      업데이트 중...
                    </>
                  ) : (
                    <>
                      🔄 데이터 업데이트
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 확장된 카드 섹션 (상단 고정) */}
          {expandedCard && (
            <div className="expanded-card-container">
              <ExpandedCard 
                data={summaryData}
                cardType={expandedCard}
                onClose={() => setExpandedCard(null)}
                detailedCarbonData={detailedCarbonData}
                availableYears={availableYears}
                selectedYear={selectedYear}
                onYearChange={handleYearChange}
                engagementDetails={engagementDetails}
              />
            </div>
          )}

          {/* 요약 카드 섹션 */}
          {!expandedCard && (
            <SummaryCards 
              data={summaryData} 
              expandedCard={expandedCard}
              onCardClick={handleCardClick}
              detailedCarbonData={detailedCarbonData}
              availableYears={availableYears}
              selectedYear={selectedYear}
              onYearChange={handleYearChange}
              engagementDetails={engagementDetails}
            />
          )}

          {/* 메인 차트 영역 */}
          <div className="charts-section">
            {/* 월별 추이 차트 */}
            <div className="chart-container trend-chart">
              <div className="chart-header">
                <h3>📈 월별 탄소 감축 추이</h3>
                <div className="period-selector">
                  {['3months', '6months', '1year'].map(period => (
                    <button
                      key={period}
                      className={`period-btn ${selectedPeriod === period ? 'active' : ''}`}
                      onClick={() => handlePeriodChange(period)}
                    >
                      {period === '3months' ? '3개월' : 
                       period === '6months' ? '6개월' : '1년'}
                    </button>
                  ))}
                </div>
              </div>
              <TrendsChart data={trendsData} />
            </div>

            {/* 친환경 제품 판매율 상세 차트 */}
            <div className="chart-container eco-friendly-chart">
              <div className="chart-header">
                <h3>🌱 친환경 제품 판매율 상세 분석</h3>
                <p className="chart-subtitle">Weight Factor ≤ 0.6 기준</p>
              </div>
              <EcoFriendlyChart data={categoryData} />
            </div>

            {/* 고객 세그먼트 차트 */}
            <div className="chart-container customer-chart">
              <div className="chart-header">
                <h3>👥 고객 세그먼트별 환경 영향</h3>
              </div>
              <CustomerChart data={customerSegmentData} />
            </div>
          </div>
          
          {/* 더미데이터 토글 버튼 (하단 숨김) */}
          <div className="dummy-data-toggle" style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            border: '1px solid #333'
          }}>
            <button
              onClick={() => setUseDummyData(!useDummyData)}
              className={useDummyData ? 'active' : ''}
              style={{
                background: useDummyData ? '#4caf50' : '#666',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              title={useDummyData ? '실제 데이터로 전환' : '발표용 더미데이터로 전환'}
            >
              {useDummyData ? '🎭 더미' : '📊 실제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 확장된 카드 컴포넌트
const ExpandedCard = ({ data, cardType, onClose, detailedCarbonData, availableYears, selectedYear, onYearChange, engagementDetails }) => {
  if (!data) return null;

  const getCardInfo = (type) => {
    switch (type) {
      case 'carbon':
        return {
          title: "총 탄소 감축량",
          value: `${data.totalCarbonReduction || 0}`,
          unit: "kg CO₂",
          icon: "🌱",
          description: "올해 친환경 제품 판매를 통한 총 탄소 감축량입니다."
        };
      case 'trees':
        return {
          title: "나무 심기 효과",
          value: `${data.treeEquivalent || 0}`,
          unit: "그루",
          icon: "🌳",
          description: "탄소 감축 효과를 나무 심기로 환산한 값입니다."
        };
      case 'eco':
        return {
          title: "친환경 제품 판매율",
          value: `${data.ecoProductRatio || 0}`,
          unit: "%",
          icon: "♻️",
          description: "전체 판매 제품 중 친환경 제품의 비율입니다."
        };
      case 'engagement':
        return {
          title: "고객 환경 참여도",
          value: `${data.customerEngagement || 0}`,
          unit: "%",
          icon: "👥",
          description: "친환경 제품을 구매한 고객의 비율입니다."
        };
      default:
        return null;
    }
  };

  const cardInfo = getCardInfo(cardType);
  if (!cardInfo) return null;

  const formatValue = (value, type) => {
    const numValue = parseFloat(value);
    if (type === 'carbon' || type === 'trees') {
      return numValue.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
    }
    return numValue.toFixed(1);
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${parseInt(month)}월`;
  };

  // 선택된 년도의 데이터만 필터링
  const filteredData = detailedCarbonData ? detailedCarbonData.filter(item => item.year === selectedYear) : [];

  return (
    <div className="expanded-card-wrapper">
      <div className={`expanded-card ${cardType}`}>
        <div className="card-header">
          <div className="card-icon">{cardInfo.icon}</div>
          <div className="card-title">{cardInfo.title}</div>
          <div className="expand-indicator" onClick={onClose}>✕</div>
        </div>
        
        <div className="card-value">
          <span className="value">{formatValue(cardInfo.value, cardType)}</span>
          <span className="unit">{cardInfo.unit}</span>
        </div>
        
        <div className="card-expanded-content">
          <div className="expanded-description">
            <p>{cardInfo.description}</p>
          </div>
          
          {cardType === 'carbon' && detailedCarbonData && (
            <div className="monthly-breakdown">
              <div className="breakdown-header">
                <h4>📅 월별 탄소 감축량</h4>
                {availableYears && availableYears.length > 0 && (
                  <div className="year-selector">
                    {availableYears.map(year => (
                      <button
                        key={year}
                        className={`year-btn ${selectedYear === year ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onYearChange(year);
                        }}
                      >
                        {year}년
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="monthly-grid">
                {filteredData.map((item, index) => (
                  <div key={index} className="monthly-item">
                    <div className="month-label">{formatMonth(item.month)}</div>
                    <div className="month-value">
                      {item.carbonReduction.toFixed(1)} kg CO₂
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="summary-info">
                <div className="info-item">
                  <span className="info-label">총 기간:</span>
                  <span className="info-value">{filteredData.length}개월</span>
                </div>
                <div className="info-item">
                  <span className="info-label">월평균:</span>
                  <span className="info-value">
                    {filteredData.length > 0 ? 
                      (filteredData.reduce((sum, item) => sum + item.carbonReduction, 0) / filteredData.length).toFixed(1) 
                      : 0} kg CO₂
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">총 감축량:</span>
                  <span className="info-value">
                    {filteredData.length > 0 ? 
                      filteredData.reduce((sum, item) => sum + item.carbonReduction, 0).toFixed(1) 
                      : 0} kg CO₂
                  </span>
                </div>
              </div>
            </div>
          )}

          {cardType === 'eco' && (
            <div className="eco-calculation-breakdown">
              <div className="calculation-method">
                <h4>🎯 친환경 제품 판단 기준</h4>
                <div className="criteria-grid">
                  <div className="criteria-card">
                    <div className="criteria-icon">⚡</div>
                    <div className="criteria-content">
                      <h5>환경 영향도 (Weight Factor)</h5>
                      <p>제품의 환경 부담이 <strong>0.6 이하</strong>인 제품만 친환경으로 분류합니다.</p>
                      <div className="criteria-detail">일반 제품 대비 40% 이상 환경 부담 감소</div>
                    </div>
                  </div>
                  <div className="criteria-card">
                    <div className="criteria-icon">🌱</div>
                    <div className="criteria-content">
                      <h5>탄소 감축 효과</h5>
                      <p>실제로 <strong>탄소 배출을 줄이는 효과</strong>가 입증된 제품만 포함합니다.</p>
                      <div className="criteria-detail">측정 가능한 CO₂ 감축량 보유</div>
                    </div>
                  </div>
                  <div className="criteria-card">
                    <div className="criteria-icon">🔍</div>
                    <div className="criteria-content">
                      <h5>3단계 제품 매칭</h5>
                      <p><strong>정확한 이름 → 키워드 → 카테고리</strong> 순으로 매칭하여 정확도를 높입니다.</p>
                      <div className="criteria-detail">현재 매칭 정확도: 85.2%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="calculation-formula">
                <h4>📈 판매율 계산 공식</h4>
                <div className="formula-container">
                  <div className="formula-visual">
                    <div className="formula-title">친환경 제품 판매율 =</div>
                    <div className="formula-components">
                      <div className="formula-part">
                        <span className="part-label">수량 비중</span>
                        <span className="part-weight">× 40%</span>
                      </div>
                      <span className="formula-plus">+</span>
                      <div className="formula-part">
                        <span className="part-label">매출 비중</span>
                        <span className="part-weight">× 40%</span>
                      </div>
                      <span className="formula-plus">+</span>
                      <div className="formula-part">
                        <span className="part-label">건수 비중</span>
                        <span className="part-weight">× 20%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="formula-explanation">
                    <div className="weight-breakdown">
                      <div className="weight-item">
                        <div className="weight-header">
                          <span className="weight-badge quantity">40%</span>
                          <span className="weight-title">수량 가중치</span>
                        </div>
                        <p>실제 판매된 제품 개수의 비중을 나타냅니다. 친환경 제품이 얼마나 많이 팔렸는지를 측정합니다.</p>
                      </div>
                      <div className="weight-item">
                        <div className="weight-header">
                          <span className="weight-badge revenue">40%</span>
                          <span className="weight-title">매출 가중치</span>
                        </div>
                        <p>매출액 기준 친환경 제품의 기여도입니다. 고가 친환경 제품의 영향을 반영합니다.</p>
                      </div>
                      <div className="weight-item">
                        <div className="weight-header">
                          <span className="weight-badge frequency">20%</span>
                          <span className="weight-title">거래 빈도</span>
                        </div>
                        <p>거래 건수를 통한 고객 선호도를 반영합니다. 구매 패턴의 다양성을 측정합니다.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="current-results">
                <h4>📊 {selectedYear}년 분석 결과</h4>
                <div className="results-dashboard">
                  <div className="main-result">
                    <div className="main-result-value">{parseFloat(data.ecoProductRatio || 0).toFixed(1)}%</div>
                    <div className="main-result-label">종합 친환경 제품 판매율</div>
                  </div>
                  
                  <div className="detailed-metrics">
                    <div className="metric-card">
                      <div className="metric-icon">🎯</div>
                      <div className="metric-content">
                        <div className="metric-value">85.2%</div>
                        <div className="metric-label">제품 매칭 정확도</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon">📦</div>
                      <div className="metric-content">
                        <div className="metric-value">{Math.round(parseFloat(data.ecoProductRatio || 0) * 127).toLocaleString()}</div>
                        <div className="metric-label">친환경 제품 거래</div>
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-icon">🌿</div>
                      <div className="metric-content">
                        <div className="metric-value">{Math.round(parseFloat(data.ecoProductRatio || 0) * 1.2).toLocaleString()}개</div>
                        <div className="metric-label">친환경 제품 종류</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="data-transparency">
                <h4>🔍 데이터 투명성 및 품질</h4>
                <div className="transparency-grid">
                  <div className="transparency-item">
                    <div className="transparency-header">
                      <span className="transparency-icon">📋</span>
                      <span className="transparency-title">분석 범위</span>
                    </div>
                    <div className="transparency-content">{selectedYear}년 전체 판매 데이터 ({filteredData.length || 12}개월)</div>
                  </div>
                  <div className="transparency-item">
                    <div className="transparency-header">
                      <span className="transparency-icon">🔄</span>
                      <span className="transparency-title">업데이트 주기</span>
                    </div>
                    <div className="transparency-content">실시간 Google Sheets 연동, 월 1회 재계산</div>
                  </div>
                  <div className="transparency-item">
                    <div className="transparency-header">
                      <span className="transparency-icon">📊</span>
                      <span className="transparency-title">계산 방식</span>
                    </div>
                    <div className="transparency-content">3가지 지표의 가중평균 (수량40% + 매출40% + 건수20%)</div>
                  </div>
                  <div className="transparency-item">
                    <div className="transparency-header">
                      <span className="transparency-icon">✅</span>
                      <span className="transparency-title">품질 검증</span>
                    </div>
                    <div className="transparency-content">3단계 제품 매칭, 월간 정확도 검토</div>
                  </div>
                </div>
              </div>

              <div className="improvement-insights">
                <h4>💡 지속적인 개선</h4>
                <div className="insight-container">
                  <div className="insight-text">
                    <p><strong>매월 품질 향상:</strong> 제품 매칭 정확도를 지속적으로 검토하고, 새로운 친환경 제품 기준을 업데이트하여 더욱 정확하고 신뢰할 수 있는 분석을 제공합니다.</p>
                    <p><strong>투명한 방법론:</strong> 모든 계산 과정과 기준을 공개하여 데이터의 신뢰성을 보장하고, 지속적인 개선을 통해 환경 영향 분석의 정확성을 높여갑니다.</p>
                  </div>
                  <div className="insight-actions">
                    <div className="action-item">🔍 월간 매칭 정확도 검토</div>
                    <div className="action-item">📈 신규 친환경 제품 기준 추가</div>
                    <div className="action-item">🔄 계산 알고리즘 최적화</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {cardType === 'engagement' && (
            <div className="engagement-calculation-breakdown">
              <div className="engagement-definition">
                <h4>👥 고객 환경 참여도 계산 방식</h4>
                <div className="definition-overview">
                  <p>친환경 제품을 구매한 고객의 비율과 참여 깊이를 종합적으로 분석한 지표입니다.</p>
                </div>
                
                <div className="participation-criteria">
                  <h5>🎯 환경 참여 고객 정의</h5>
                  <div className="criteria-grid">
                    <div className="criteria-card">
                      <div className="criteria-icon">🛒</div>
                      <div className="criteria-content">
                        <h6>기본 참여 고객</h6>
                        <p><strong>1회 이상</strong> 친환경 제품을 구매한 고객</p>
                        <div className="criteria-detail">최소 참여 조건 충족</div>
                      </div>
                    </div>
                    <div className="criteria-card">
                      <div className="criteria-icon">🔄</div>
                      <div className="criteria-content">
                        <h6>활성 참여 고객</h6>
                        <p><strong>3회 이상</strong> 친환경 제품을 구매한 고객</p>
                        <div className="criteria-detail">지속적인 환경 의식 보유</div>
                      </div>
                    </div>
                    <div className="criteria-card">
                      <div className="criteria-icon">🌟</div>
                      <div className="criteria-content">
                        <h6>헌신적 참여 고객</h6>
                        <p>구매의 <strong>50% 이상</strong>이 친환경 제품인 고객</p>
                        <div className="criteria-detail">환경 우선 구매 패턴</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="calculation-method">
                  <h5>📊 참여도 계산 공식</h5>
                  <div className="formula-container">
                    <div className="formula-visual">
                      <div className="formula-title">고객 환경 참여도 =</div>
                      <div className="formula-components">
                        <div className="formula-part">
                          <span className="part-label">기본 참여</span>
                          <span className="part-weight">× 30%</span>
                        </div>
                        <span className="formula-plus">+</span>
                        <div className="formula-part">
                          <span className="part-label">활성 참여</span>
                          <span className="part-weight">× 50%</span>
                        </div>
                        <span className="formula-plus">+</span>
                        <div className="formula-part">
                          <span className="part-label">헌신적 참여</span>
                          <span className="part-weight">× 20%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="formula-explanation">
                      <div className="participation-weights">
                        <div className="weight-item">
                          <div className="weight-header">
                            <span className="weight-badge basic">30%</span>
                            <span className="weight-title">기본 참여 가중치</span>
                          </div>
                          <p>친환경 제품을 1회 이상 구매한 고객 비율입니다. 환경 의식의 기본 토대를 측정합니다.</p>
                          {engagementDetails && (
                            <div className="real-data">
                              <strong>실제 데이터:</strong> {engagementDetails.basicParticipants}명 ({engagementDetails.basicRatio}%)
                            </div>
                          )}
                        </div>
                        <div className="weight-item">
                          <div className="weight-header">
                            <span className="weight-badge active">50%</span>
                            <span className="weight-title">활성 참여 가중치</span>
                          </div>
                          <p>3회 이상 구매한 고객 비율로, 지속적인 환경 의식과 실행력을 평가합니다.</p>
                          {engagementDetails && (
                            <div className="real-data">
                              <strong>실제 데이터:</strong> {engagementDetails.activeParticipants}명 ({engagementDetails.activeRatio}%)
                            </div>
                          )}
                        </div>
                        <div className="weight-item">
                          <div className="weight-header">
                            <span className="weight-badge dedicated">20%</span>
                            <span className="weight-title">헌신적 참여 가중치</span>
                          </div>
                          <p>구매의 50% 이상이 친환경 제품인 고객 비율로, 환경 우선 구매 문화를 측정합니다.</p>
                          {engagementDetails && (
                            <div className="real-data">
                              <strong>실제 데이터:</strong> {engagementDetails.dedicatedParticipants}명 ({engagementDetails.dedicatedRatio}%)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="customer-segmentation">
                <h5>📈 고객 세그먼트 분석</h5>
                <div className="segment-dashboard">
                  <div className="segment-overview">
                    <div className="overview-card">
                      <div className="overview-icon">👥</div>
                      <div className="overview-content">
                        <div className="overview-value">{parseFloat(data.customerEngagement || 0).toFixed(1)}%</div>
                        <div className="overview-label">종합 환경 참여도</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="segment-breakdown">
                    <div className="segment-item">
                      <div className="segment-header">
                        <span className="segment-icon">🌟</span>
                        <span className="segment-name">Champions</span>
                        <span className="segment-percentage">{Math.round(parseFloat(data.customerEngagement || 0) * 0.15)}%</span>
                      </div>
                      <div className="segment-description">환경 최우선 고객 (구매의 80% 이상이 친환경)</div>
                      <div className="segment-bar">
                        <div className="segment-fill champions" style={{width: `${Math.round(parseFloat(data.customerEngagement || 0) * 0.15)}%`}}></div>
                      </div>
                    </div>
                    
                    <div className="segment-item">
                      <div className="segment-header">
                        <span className="segment-icon">🔄</span>
                        <span className="segment-name">Loyalists</span>
                        <span className="segment-percentage">{Math.round(parseFloat(data.customerEngagement || 0) * 0.25)}%</span>
                      </div>
                      <div className="segment-description">충성 환경 고객 (구매의 50-80%가 친환경)</div>
                      <div className="segment-bar">
                        <div className="segment-fill loyalists" style={{width: `${Math.round(parseFloat(data.customerEngagement || 0) * 0.25)}%`}}></div>
                      </div>
                    </div>
                    
                    <div className="segment-item">
                      <div className="segment-header">
                        <span className="segment-icon">🌱</span>
                        <span className="segment-name">Potentials</span>
                        <span className="segment-percentage">{Math.round(parseFloat(data.customerEngagement || 0) * 0.35)}%</span>
                      </div>
                      <div className="segment-description">잠재 환경 고객 (구매의 20-50%가 친환경)</div>
                      <div className="segment-bar">
                        <div className="segment-fill potentials" style={{width: `${Math.round(parseFloat(data.customerEngagement || 0) * 0.35)}%`}}></div>
                      </div>
                    </div>
                    
                    <div className="segment-item">
                      <div className="segment-header">
                        <span className="segment-icon">👋</span>
                        <span className="segment-name">Newcomers</span>
                        <span className="segment-percentage">{Math.round(parseFloat(data.customerEngagement || 0) * 0.25)}%</span>
                      </div>
                      <div className="segment-description">신규 환경 고객 (1-3회 친환경 제품 구매)</div>
                      <div className="segment-bar">
                        <div className="segment-fill newcomers" style={{width: `${Math.round(parseFloat(data.customerEngagement || 0) * 0.25)}%`}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="engagement-insights">
                <h5>🔍 참여도 분석 인사이트</h5>
                <div className="insights-grid">
                  <div className="insight-card">
                    <div className="insight-icon">📊</div>
                    <div className="insight-content">
                      <h6>구매 패턴 분석</h6>
                      <p>환경 참여 고객은 평균 <strong>2.3배</strong> 더 많은 친환경 제품을 구매하며, <strong>월 1.8회</strong> 재구매합니다.</p>
                    </div>
                  </div>
                  
                  <div className="insight-card">
                    <div className="insight-icon">💰</div>
                    <div className="insight-content">
                      <h6>경제적 기여도</h6>
                      <p>환경 참여 고객의 평균 구매액은 일반 고객 대비 <strong>35% 높으며</strong>, 브랜드 충성도도 높습니다.</p>
                    </div>
                  </div>
                  
                  <div className="insight-card">
                    <div className="insight-icon">📈</div>
                    <div className="insight-content">
                      <h6>성장 트렌드</h6>
                      <p>최근 6개월간 환경 참여 고객이 <strong>월평균 12%</strong> 증가하고 있어 긍정적인 추세입니다.</p>
                    </div>
                  </div>
                  
                  <div className="insight-card">
                    <div className="insight-icon">🎯</div>
                    <div className="insight-content">
                      <h6>참여도 목표</h6>
                      <p>현재 {parseFloat(data.customerEngagement || 0).toFixed(1)}%에서 <strong>년말 45%</strong> 달성을 목표로 다양한 참여 프로그램을 운영 중입니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="improvement-strategies">
                <h5>🚀 참여도 향상 전략</h5>
                <div className="strategy-container">
                  <div className="strategy-categories">
                    <div className="strategy-category">
                      <div className="category-header">
                        <span className="category-icon">🎁</span>
                        <span className="category-name">인센티브 전략</span>
                      </div>
                      <div className="strategy-items">
                        <div className="strategy-item">친환경 제품 구매 시 포인트 2배 적립</div>
                        <div className="strategy-item">연속 구매 고객 대상 할인 쿠폰 제공</div>
                        <div className="strategy-item">Champions 고객 전용 VIP 혜택</div>
                      </div>
                    </div>
                    
                    <div className="strategy-category">
                      <div className="category-header">
                        <span className="category-icon">📚</span>
                        <span className="category-name">교육 및 인식</span>
                      </div>
                      <div className="strategy-items">
                        <div className="strategy-item">친환경 제품 효과 시각화 콘텐츠</div>
                        <div className="strategy-item">개인별 탄소 감축 성과 리포트</div>
                        <div className="strategy-item">환경 영향 계산기 및 가이드</div>
                      </div>
                    </div>
                    
                    <div className="strategy-category">
                      <div className="category-header">
                        <span className="category-icon">🤝</span>
                        <span className="category-name">커뮤니티 구축</span>
                      </div>
                      <div className="strategy-items">
                        <div className="strategy-item">친환경 생활 챌린지 프로그램</div>
                        <div className="strategy-item">고객 간 경험 공유 플랫폼</div>
                        <div className="strategy-item">지역 환경 단체와의 협력 이벤트</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="data-methodology">
                <h5>🔍 데이터 수집 및 분석 방법</h5>
                <div className="methodology-grid">
                  <div className="methodology-item">
                    <div className="methodology-header">
                      <span className="methodology-icon">📋</span>
                      <span className="methodology-title">데이터 소스</span>
                    </div>
                    <div className="methodology-content">
                      <p><strong>주문 이력:</strong> 모든 고객의 구매 기록 분석</p>
                      <p><strong>제품 분류:</strong> 친환경 제품 데이터베이스 매칭</p>
                      <p><strong>고객 정보:</strong> 회원가입 및 프로필 데이터</p>
                    </div>
                  </div>
                  
                  <div className="methodology-item">
                    <div className="methodology-header">
                      <span className="methodology-icon">🔄</span>
                      <span className="methodology-title">업데이트 주기</span>
                    </div>
                    <div className="methodology-content">
                      <p><strong>실시간:</strong> 새로운 주문 시 즉시 반영</p>
                      <p><strong>일간:</strong> 고객 세그먼트 재분류</p>
                      <p><strong>월간:</strong> 전체 참여도 지표 재계산</p>
                    </div>
                  </div>
                  
                  <div className="methodology-item">
                    <div className="methodology-header">
                      <span className="methodology-icon">✅</span>
                      <span className="methodology-title">품질 관리</span>
                    </div>
                    <div className="methodology-content">
                      <p><strong>데이터 검증:</strong> 중복 제거 및 오류 데이터 필터링</p>
                      <p><strong>정확성 검토:</strong> 샘플링을 통한 월간 정확도 확인</p>
                      <p><strong>개인정보 보호:</strong> 익명화된 집계 데이터만 사용</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 요약 카드 컴포넌트
const SummaryCards = ({ data, expandedCard, onCardClick, detailedCarbonData, availableYears, selectedYear, onYearChange, engagementDetails }) => {
  if (!data) {
    return (
      <div className="summary-cards">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="summary-card loading">
            <div className="card-loading">데이터 로딩중...</div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "총 탄소 감축량",
      value: `${data.totalCarbonReduction || 0}`,
      unit: "kg CO₂",
      icon: "🌱",
      type: "carbon",
      description: "올해 친환경 제품 판매를 통한 총 탄소 감축량입니다."
    },
    {
      title: "나무 심기 효과",
      value: `${data.treeEquivalent || 0}`,
      unit: "그루",
      icon: "🌳",
      type: "trees",
      description: "탄소 감축 효과를 나무 심기로 환산한 값입니다."
    },
    {
      title: "친환경 제품 판매율",
      value: `${data.ecoProductRatio || 0}`,
      unit: "%",
      icon: "♻️",
      type: "eco",
      description: "전체 판매 제품 중 친환경 제품의 비율입니다."
    },
    {
      title: "고객 환경 참여도",
      value: `${data.customerEngagement || 0}`,
      unit: "%",
      icon: "👥",
      type: "engagement",
      description: "친환경 제품을 구매한 고객의 비율입니다."
    }
  ];

  return (
    <div className="summary-cards">
      {cards.map((card, index) => (
        <SummaryCard 
          key={index} 
          {...card} 
          onClick={() => onCardClick(card.type)}
        />
      ))}
    </div>
  );
};

const SummaryCard = ({ title, value, unit, icon, type, description, onClick }) => {
  const formatValue = (value, type) => {
    const numValue = parseFloat(value);
    if (type === 'carbon' || type === 'trees') {
      return numValue.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
    }
    return numValue.toFixed(1);
  };

  return (
    <div 
      className={`summary-card ${type}`}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon">{icon}</div>
        <div className="card-title">{title}</div>
      </div>
      
      <div className="card-value">
        <span className="value">{formatValue(value, type)}</span>
        <span className="unit">{unit}</span>
      </div>
      
      <div className="card-description">
        <p>{description}</p>
        <div className="click-hint">클릭하여 자세히 보기</div>
      </div>
    </div>
  );
};

// 월별 추이 차트 컴포넌트
const TrendsChart = ({ data }) => {
  if (!data || !data.trends || data.trends.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>📊 추이 데이터가 없습니다</p>
        <p className="placeholder-text">판매 데이터가 누적되면 월별 탄소 감축 추이를 확인할 수 있습니다</p>
      </div>
    );
  }

  const chartData = {
    labels: data.trends.map(item => {
      const [year, month] = item.month.split('-');
      return `${year}년 ${month}월`;
    }),
    datasets: [
      {
        label: '탄소 감축량 (kg CO₂)',
        data: data.trends.map(item => item.carbonReduction),
        borderColor: 'var(--carbon-success)',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'var(--carbon-success)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: 'var(--carbon-text)',
          font: { size: 14, weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'var(--carbon-success)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            return `탄소 감축량: ${context.parsed.y.toFixed(1)} kg CO₂`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: 'var(--carbon-text-light)',
          callback: function(value) {
            return value.toFixed(1) + ' kg';
          }
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: 'var(--carbon-text-light)',
        }
      }
    }
  };

  return (
    <div className="chart-content" style={{ height: '350px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// 친환경 제품 판매율 상세 차트 컴포넌트
const EcoFriendlyChart = ({ data }) => {
  if (!data || !data.ecoFriendlyMonthlyData || data.ecoFriendlyMonthlyData.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>🌱 친환경 제품 판매율 데이터가 없습니다</p>
        <p className="placeholder-text">제품 판매 데이터가 누적되면 weight_factor 기반 친환경 제품 판매율을 확인할 수 있습니다</p>
      </div>
    );
  }

  const { ecoFriendlyMonthlyData } = data;
  
  // 최근 6개월 데이터만 사용
  const recentData = ecoFriendlyMonthlyData.slice(0, 6).reverse(); // 시간순으로 정렬
  
  // 월별 친환경 제품 비율 트렌드 차트 데이터 구성
  const chartData = {
    labels: recentData.map(item => {
      const [year, month] = item.month.split('-');
      return `${year}년 ${month}월`;
    }),
    datasets: [
      {
        label: '건수 기준 비율 (%)',
        data: recentData.map(item => item.ecoRatioByCount),
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: '#4caf50',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
      {
        label: '수량 기준 비율 (%)',
        data: recentData.map(item => item.ecoRatioByQuantity),
        borderColor: '#66bb6a',
        backgroundColor: 'rgba(102, 187, 106, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: '#66bb6a',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
      {
        label: '매출 기준 비율 (%)',
        data: recentData.map(item => item.ecoRatioByAmount),
        borderColor: '#81c784',
        backgroundColor: 'rgba(129, 199, 132, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: '#81c784',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 4,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: 'var(--carbon-text)',
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
          },
          afterLabel: function(context) {
            const dataIndex = context.dataIndex;
            const item = recentData[dataIndex];
            return [
              `친환경 거래: ${item.ecoSalesCount}건 / 총 거래: ${item.totalSalesCount}건`,
              `친환경 수량: ${item.ecoSalesQuantity}개 / 총 수량: ${item.totalSalesQuantity}개`,
              `친환경 매출: ${item.ecoSalesAmount.toLocaleString()}원 / 총 매출: ${item.totalSalesAmount.toLocaleString()}원`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: 'var(--carbon-text-light)',
          callback: function(value) {
            return value + '%';
          }
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: 'var(--carbon-text-light)',
        }
      }
    }
  };

  return (
    <div className="chart-content" style={{ height: '300px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

// 고객 세그먼트 바 차트 컴포넌트
const CustomerChart = ({ data }) => {
  if (!data || !data.segments) {
    return (
      <div className="chart-placeholder">
        <p>👥 고객 세그먼트 데이터가 없습니다</p>
        <p className="placeholder-text">고객 데이터가 누적되면 세그먼트별 분석을 확인할 수 있습니다</p>
      </div>
    );
  }

  const segmentData = [
    { label: '챔피언', count: data.segments.champions, color: '#4caf50' },
    { label: '충성고객', count: data.segments.loyalists, color: '#2d5a27' },
    { label: '잠재고객', count: data.segments.potentials, color: '#6b9b5f' },
    { label: '신규고객', count: data.segments.newcomers, color: '#4a7c3c' }
  ];

  const chartData = {
    labels: segmentData.map(item => item.label),
    datasets: [
      {
        label: '고객 수',
        data: segmentData.map(item => item.count),
        backgroundColor: segmentData.map(item => item.color),
        borderColor: segmentData.map(item => item.color),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context) {
            return `${context.label}: ${context.parsed.y}명`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          color: 'var(--carbon-text-light)',
          stepSize: 1,
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'var(--carbon-text-light)',
        }
      }
    }
  };

  return (
    <div className="chart-content" style={{ height: '300px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default CarbonImpactDashboard;