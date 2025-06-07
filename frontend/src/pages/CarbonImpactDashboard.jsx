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
  const [detailedCarbonData, setDetailedCarbonData] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);

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
        setCategoryData({ categories: calculatedData.categoryData });
        setCustomerSegmentData({ segments: calculatedData.segmentData });
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
          "'탄소_감축'!G2:H20",  // 카테고리별 감축량
          "'탄소_감축'!J2:K10"   // 고객 세그먼트
        ]
      });

      const [summaryRange, monthlyRange, categoryRange, segmentRange] = carbonReductionResponse.result.valueRanges;
      
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
      
      // 카테고리별 데이터 파싱
      const categoryValues = categoryRange.values || [];
      const categoryData = categoryValues
        .filter(row => row.length >= 2 && row[0] && row[1])
        .map(row => ({
          category: row[0],
          totalCarbonReduction: parseFloat(row[1]) || 0
        }))
        .sort((a, b) => b.totalCarbonReduction - a.totalCarbonReduction);
      
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
      
      // 사용 가능한 년도 목록 생성
      const years = [...new Set(monthlyData.map(item => item.year))].sort((a, b) => b - a);
      
      console.log('탄소 감축 데이터 로드 완료:', {
        summary: summaryData,
        monthly: monthlyData.length,
        categories: categoryData.length,
        segments: segmentData,
        years: years
      });

      // 상태 업데이트
      setSummaryData(summaryData);
      setDetailedCarbonData(monthlyData);
      setCategoryData({ categories: categoryData });
      setCustomerSegmentData({ segments: segmentData });
      setAvailableYears(years);

    } catch (error) {
      console.error('탄소 감축 데이터 로드 실패:', error);
      let errorMessage = '탄소 감축 데이터를 불러오는 중 오류가 발생했습니다.';
      
      if (error.message && error.message.includes('탄소_감축 시트가 없습니다')) {
        errorMessage = error.message;
      } else if (error.status === 400) {
        errorMessage = '탄소_감축 시트의 범위가 올바르지 않습니다. 시트 구조를 확인해주세요.';
      } else if (error.status === 404) {
        errorMessage = '시트를 찾을 수 없습니다. 시트 ID와 권한을 확인해주세요.';
      } else if (error.status === 403) {
        errorMessage = '시트에 접근할 권한이 없습니다.';
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
          range: "'제품_판매_기록'!A2:I",
        }),
        window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: sheet.sheetId,
          range: "'고객_정보'!A2:I",
        }),
        // CSV 파일 로드
        fetch('/data/생활용품 탄소배출량.csv').then(response => response.text())
      ]);

      // 판매 데이터 파싱
      const salesRows = (salesResponse.result.values || [])
        .map((row, index) => {
          const orderId = row[0] || '';
          const customerName = row[1] || '';
          const customerId = row[2] || '';
          const dateStr = row[3] || '';
          const productName = row[4] || '';
          const category = row[5] || '';
          const quantity = parseInt(row[6]) || 1;
          const amountStr = row[7] || '';
          const paymentMethod = row[8] || '';

          if (!customerName || !productName || !dateStr || !amountStr) return null;
          
          try {
            const date = parseDate(dateStr);
            const amount = Number(amountStr.replace(/[,₩\s]/g, "")) || 0;
            
            return { 
              orderId, customerName, customerId, date, productName, 
              category, quantity, amount, paymentMethod 
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
      
      // 사용 가능한 년도 목록 생성
      const years = [...new Set(salesData.map(sale => sale.date.getFullYear()))].sort((a, b) => b - a);
      console.log('사용 가능한 년도:', years);
      
      // 올해 데이터로 요약 계산
      const currentYear = new Date().getFullYear();
      const thisYearSales = salesData.filter(sale => sale.date.getFullYear() === currentYear);
      console.log(`${currentYear}년 판매 데이터:`, thisYearSales.length);
      
      // 실제 데이터 기반 탄소 감축량 계산
      const allMonthlyReduction = {};
      let totalCarbonReduction = 0;
      let ecoProductCount = 0;
      let totalProductCount = 0;
      
      // 제품명 정규화 함수
      const normalizeProductName = (name) => {
        return name.toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[()]/g, '')
          .replace(/[0-9]+ml|[0-9]+g|[0-9]+개/g, '');
      };
      
      // 판매 데이터와 탄소 배출 데이터 매칭
      salesData.forEach(sale => {
        totalProductCount++;
        
        // 판매 제품과 탄소 배출 데이터 매칭
        const normalizedSaleProduct = normalizeProductName(sale.productName || '');
        
        // 1차: 정확한 제품명 매칭
        let matchedProduct = carbonEmissionData.find(carbon => 
          normalizeProductName(carbon.productName) === normalizedSaleProduct
        );
        
        // 2차: 키워드 기반 매칭
        if (!matchedProduct && normalizedSaleProduct.length > 0) {
          matchedProduct = carbonEmissionData.find(carbon => {
            const normalizedCarbonProduct = normalizeProductName(carbon.productName);
            return normalizedCarbonProduct.includes(normalizedSaleProduct) || 
                   normalizedSaleProduct.includes(normalizedCarbonProduct);
          });
        }
        
        // 3차: 카테고리 기반 매칭
        if (!matchedProduct && sale.category) {
          const categoryKeywords = {
            '컵류': ['컵', 'cup'],
            '포장': ['포장', '봉투', 'bag'],
            '병류': ['병', '보틀', 'bottle'],
            '용기': ['용기', 'container']
          };
          
          const saleCategory = sale.category.toLowerCase();
          for (const [key, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => saleCategory.includes(keyword))) {
              matchedProduct = carbonEmissionData.find(carbon => 
                carbon.category && carbon.category.includes(key)
              );
              if (matchedProduct) break;
            }
          }
        }
        
        if (matchedProduct) {
          // 친환경 제품 여부 확인 (weight_factor < 1.0)
          const isEcoProduct = matchedProduct.weightFactor < 1.0;
          
          if (isEcoProduct) {
            // 실제 탄소 감축량 계산
            const reduction = matchedProduct.reductionEffect || 0;
            const monthKey = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!allMonthlyReduction[monthKey]) {
              allMonthlyReduction[monthKey] = 0;
            }
            allMonthlyReduction[monthKey] += reduction * sale.quantity;
            
            // 올해 데이터만 요약에 포함
            if (sale.date.getFullYear() === currentYear) {
              totalCarbonReduction += reduction * sale.quantity;
              ecoProductCount++;
            }
          }
        }
      });
      
      console.log('실제 데이터 매칭 결과:', {
        totalProducts: totalProductCount,
        ecoProducts: ecoProductCount,
        totalReduction: totalCarbonReduction
      });
      
      // 나무 심기 환산 (1그루당 22kg CO2 흡수)
      const treeEquivalent = Math.round(totalCarbonReduction / 22);
      
      // 친환경 제품 비율 (실제 데이터 기반)
      const thisYearEcoCount = thisYearSales.filter(sale => {
        const normalizedSaleProduct = normalizeProductName(sale.productName || '');
        const matchedProduct = carbonEmissionData.find(carbon => 
          normalizeProductName(carbon.productName) === normalizedSaleProduct ||
          normalizeProductName(carbon.productName).includes(normalizedSaleProduct) ||
          normalizedSaleProduct.includes(normalizeProductName(carbon.productName))
        );
        return matchedProduct && matchedProduct.weightFactor < 1.0;
      }).length;
      
      const ecoProductRatio = thisYearSales.length > 0 ? 
        Math.round((thisYearEcoCount / thisYearSales.length) * 100 * 10) / 10 : 0;
      
      // 고객 환경 참여도 (실제 데이터 기반)
      const uniqueCustomers = [...new Set(thisYearSales.map(sale => sale.customerId || sale.customerName))];
      const ecoCustomers = [...new Set(thisYearSales
        .filter(sale => {
          const normalizedSaleProduct = normalizeProductName(sale.productName || '');
          const matchedProduct = carbonEmissionData.find(carbon => 
            normalizeProductName(carbon.productName) === normalizedSaleProduct ||
            normalizeProductName(carbon.productName).includes(normalizedSaleProduct) ||
            normalizedSaleProduct.includes(normalizeProductName(carbon.productName))
          );
          return matchedProduct && matchedProduct.weightFactor < 1.0;
        })
        .map(sale => sale.customerId || sale.customerName))];
      
      const customerEngagement = uniqueCustomers.length > 0 ? 
        Math.round((ecoCustomers.length / uniqueCustomers.length) * 100 * 10) / 10 : 0;
      
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
      
             // 카테고리별 데이터 계산
       const categoryReductions = {};
      
      salesData.forEach(sale => {
        const normalizedSaleProduct = normalizeProductName(sale.productName || '');
        
        // 판매 제품과 탄소 배출 데이터 매칭
        let matchedProduct = carbonEmissionData.find(carbon => 
          normalizeProductName(carbon.productName) === normalizedSaleProduct ||
          normalizeProductName(carbon.productName).includes(normalizedSaleProduct) ||
          normalizedSaleProduct.includes(normalizeProductName(carbon.productName))
        );
        
        if (matchedProduct && matchedProduct.weightFactor < 1.0) {
          const category = matchedProduct.category || '기타';
          const reduction = (matchedProduct.reductionEffect || 0) * sale.quantity;
          
          if (!categoryReductions[category]) {
            categoryReductions[category] = 0;
          }
          categoryReductions[category] += reduction;
        }
      });
      
      // 카테고리별 데이터 정렬
      const categoryData = Object.entries(categoryReductions)
        .map(([category, totalCarbonReduction]) => ({
          category,
          totalCarbonReduction: Math.round(totalCarbonReduction * 10) / 10
        }))
        .sort((a, b) => b.totalCarbonReduction - a.totalCarbonReduction);

      // 고객 세그먼트 데이터 계산
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
        
        // 친환경 제품 여부 확인
        const normalizedSaleProduct = normalizeProductName(sale.productName || '');
        const matchedProduct = carbonEmissionData.find(carbon => 
          normalizeProductName(carbon.productName) === normalizedSaleProduct ||
          normalizeProductName(carbon.productName).includes(normalizedSaleProduct) ||
          normalizedSaleProduct.includes(normalizeProductName(carbon.productName))
        );
        
        if (matchedProduct && matchedProduct.weightFactor < 1.0) {
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
      
      console.log('탄소 감축 계산 완료:', {
        summary: summaryData,
        monthly: detailedData.length,
        categories: categoryData.length,
        segments: segmentData,
        years: years
      });

      return {
        summaryData,
        detailedData,
        categoryData,
        segmentData,
        years
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
      const { summaryData, detailedData, categoryData, segmentData } = calculatedData;
      
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

      // 3. 월별 데이터, 카테고리별 데이터, 세그먼트 데이터를 별도로 추가
      const monthlyValues = [['년월', '감축량']];
      detailedData.forEach(item => {
        monthlyValues.push([item.month, item.carbonReduction]);
      });

      const categoryValues = [['카테고리', '감축량']];
      categoryData.forEach(item => {
        categoryValues.push([item.category, item.totalCarbonReduction]);
      });

      const segmentValues = [['세그먼트', '고객수']];
      segmentValues.push(['champions', segmentData.champions]);
      segmentValues.push(['loyalists', segmentData.loyalists]);
      segmentValues.push(['potentials', segmentData.potentials]);
      segmentValues.push(['newcomers', segmentData.newcomers]);

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
              range: `'탄소_감축'!G1:H${categoryValues.length}`,
              values: categoryValues
            },
            {
              range: `'탄소_감축'!J1:K${segmentValues.length}`,
              values: segmentValues
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
    if (user && sheet) {
      console.log('탄소 감축 데이터 로딩 시작:', { user: user.email, sheet: sheet.name });
      loadCarbonReductionData();
    } else {
      console.log('로딩 조건 불충족:', { user: !!user, sheet: !!sheet });
      setLoading(false);
    }
  }, [user, sheet]);

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
              <button onClick={() => loadAllData()}>
                다시 시도
              </button>
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
            <h1>🌱 탄소 감축 현황 대시보드</h1>
            <p>친환경 제품 판매를 통한 탄소 감축 효과를 확인하세요</p>
            <div className="last-updated">
              마지막 업데이트: {summaryData?.lastUpdated ? 
                new Date(summaryData.lastUpdated).toLocaleString('ko-KR') : 
                '데이터 없음'
              }
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

            {/* 카테고리별 차트 */}
            <div className="chart-container category-chart">
              <div className="chart-header">
                <h3>🏷️ 카테고리별 감축 기여도</h3>
              </div>
              <CategoryChart data={categoryData} />
            </div>

            {/* 고객 세그먼트 차트 */}
            <div className="chart-container customer-chart">
              <div className="chart-header">
                <h3>👥 고객 세그먼트별 환경 영향</h3>
              </div>
              <CustomerChart data={customerSegmentData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 확장된 카드 컴포넌트
const ExpandedCard = ({ data, cardType, onClose, detailedCarbonData, availableYears, selectedYear, onYearChange }) => {
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
        </div>
      </div>
    </div>
  );
};

// 요약 카드 컴포넌트
const SummaryCards = ({ data, expandedCard, onCardClick, detailedCarbonData, availableYears, selectedYear, onYearChange }) => {
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

// 카테고리별 파이 차트 컴포넌트
const CategoryChart = ({ data }) => {
  if (!data || !data.categories || data.categories.length === 0) {
    return (
      <div className="chart-placeholder">
        <p>🏷️ 카테고리 데이터가 없습니다</p>
        <p className="placeholder-text">제품 판매 데이터가 누적되면 카테고리별 기여도를 확인할 수 있습니다</p>
      </div>
    );
  }

  const colors = [
    '#4caf50', '#2d5a27', '#6b9b5f', '#4a7c3c', '#81c784',
    '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32'
  ];

  const chartData = {
    labels: data.categories.map(cat => cat.category),
    datasets: [
      {
        data: data.categories.map(cat => Math.abs(cat.totalCarbonReduction)),
        backgroundColor: colors.slice(0, data.categories.length),
        borderColor: 'white',
        borderWidth: 2,
        hoverBorderWidth: 3,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: 'var(--carbon-text)',
          font: { size: 12 },
          padding: 15,
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value.toFixed(1)} kg CO₂ (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div className="chart-content" style={{ height: '300px' }}>
      <Pie data={chartData} options={options} />
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