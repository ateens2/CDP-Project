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

const CarbonImpactDashboard = () => {
  const { user, sheets } = useContext(UserContext);
  const { state } = useLocation();
  const sheet = state?.sheet || (sheets && sheets.length > 0 ? sheets[0] : null);

  // 상태 관리
  const [summaryData, setSummaryData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('6months');

  // API 호출 함수들
  const fetchSummaryData = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/carbon-impact/summary');
      const result = await response.json();
      if (result.success) {
        setSummaryData(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch summary data:', err);
    }
  };

  const fetchTrendsData = async (period) => {
    try {
      const response = await fetch(`http://localhost:3000/api/carbon-impact/trends?period=${period}`);
      const result = await response.json();
      if (result.success) {
        setTrendsData(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch trends data:', err);
    }
  };

  const fetchCategoryData = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/carbon-impact/by-category');
      const result = await response.json();
      if (result.success) {
        setCategoryData(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch category data:', err);
    }
  };

  const fetchCustomerData = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/carbon-impact/by-customer?limit=10');
      const result = await response.json();
      if (result.success) {
        setCustomerData(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch customer data:', err);
    }
  };

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchSummaryData(),
          fetchTrendsData(selectedPeriod),
          fetchCategoryData(),
          fetchCustomerData()
        ]);
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedPeriod]);

  // 기간 변경 핸들러
  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    fetchTrendsData(period);
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
              <button onClick={() => window.location.reload()}>
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

          {/* 요약 카드 섹션 */}
          <SummaryCards data={summaryData} />

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
              <CustomerChart data={customerData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 요약 카드 컴포넌트
const SummaryCards = ({ data }) => {
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
      growth: data.growthRates?.carbonReduction || 0,
      type: "carbon"
    },
    {
      title: "나무 심기 효과",
      value: `${data.treeEquivalent || 0}`,
      unit: "그루",
      icon: "🌳",
      growth: data.growthRates?.carbonReduction || 0,
      type: "trees"
    },
    {
      title: "친환경 제품 판매율",
      value: `${data.ecoProductRatio || 0}`,
      unit: "%",
      icon: "♻️",
      growth: data.growthRates?.ecoProductRatio || 0,
      type: "eco"
    },
    {
      title: "고객 환경 참여도",
      value: `${data.customerEngagement || 0}`,
      unit: "%",
      icon: "👥",
      growth: data.growthRates?.customerEngagement || 0,
      type: "engagement"
    }
  ];

  return (
    <div className="summary-cards">
      {cards.map((card, index) => (
        <SummaryCard key={index} {...card} />
      ))}
    </div>
  );
};

const SummaryCard = ({ title, value, unit, icon, growth, type }) => {
  const getGrowthIcon = (growth) => {
    if (growth > 0) return "📈";
    if (growth < 0) return "📉";
    return "➖";
  };

  const getGrowthClass = (growth) => {
    if (growth > 0) return "positive";
    if (growth < 0) return "negative";
    return "neutral";
  };

  const formatValue = (value, type) => {
    const numValue = parseFloat(value);
    if (type === 'carbon' || type === 'trees') {
      return numValue.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
    }
    return numValue.toFixed(1);
  };

  return (
    <div className={`summary-card ${type}`}>
      <div className="card-header">
        <div className="card-icon">{icon}</div>
        <div className="card-title">{title}</div>
      </div>
      
      <div className="card-value">
        <span className="value">{formatValue(value, type)}</span>
        <span className="unit">{unit}</span>
      </div>
      
      <div className={`card-growth ${getGrowthClass(growth)}`}>
        <span className="growth-icon">{getGrowthIcon(growth)}</span>
        <span className="growth-text">
          전월 대비 {Math.abs(growth).toFixed(1)}%
          {growth > 0 ? ' 증가' : growth < 0 ? ' 감소' : ' 동일'}
        </span>
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