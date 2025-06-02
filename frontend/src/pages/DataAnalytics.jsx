// src/pages/DataAnalytics.jsx

import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Chart from "chart.js/auto";
import Header from "../components/Header";
import Category from "../components/Category";
import { UserContext } from "../contexts/UserContext";
import "./DataAnalytics.css";

// 날짜 문자열 "YYYY-MM-DD"를 Date 객체로 변환
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d);
}

// 일별 매출 집계
function aggregateDaily(rows) {
  const bucket = {};
  rows.forEach(({ date, amount }) => {
    const key = date.toISOString().slice(0, 10);
    bucket[key] = (bucket[key] || 0) + amount;
  });
  const labels = Object.keys(bucket).sort();
  const values = labels.map((k) => bucket[k]);
  return { labels, values };
}

// ISO 주차 구하기 헬퍼
function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNum };
}

// 주별 매출 집계
function aggregateWeekly(rows) {
  const bucket = {};
  rows.forEach(({ date, amount }) => {
    const { year, week } = getISOWeek(date);
    const key = `${year}-W${week.toString().padStart(2, "0")}`;
    bucket[key] = (bucket[key] || 0) + amount;
  });
  const labels = Object.keys(bucket).sort();
  const values = labels.map((k) => bucket[k]);
  return { labels, values };
}

// 월별 매출 집계
function aggregateMonthly(rows) {
  const bucket = {};
  rows.forEach(({ date, amount }) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const key = `${y}-${m}`;
    bucket[key] = (bucket[key] || 0) + amount;
  });
  const labels = Object.keys(bucket).sort();
  const values = labels.map((k) => bucket[k]);
  return { labels, values };
}

// 분기별 매출 집계
function aggregateQuarterly(rows) {
  const bucket = {};
  rows.forEach(({ date, amount }) => {
    const y = date.getFullYear();
    const q = Math.ceil((date.getMonth() + 1) / 3);
    const key = `${y}-Q${q}`;
    bucket[key] = (bucket[key] || 0) + amount;
  });
  const labels = Object.keys(bucket).sort();
  const values = labels.map((k) => bucket[k]);
  return { labels, values };
}

// 연간 매출 집계
function aggregateYearly(rows) {
  const bucket = {};
  rows.forEach(({ date, amount }) => {
    const y = date.getFullYear().toString();
    bucket[y] = (bucket[y] || 0) + amount;
  });
  const labels = Object.keys(bucket).sort();
  const values = labels.map((k) => bucket[k]);
  return { labels, values };
}

const DataAnalytics = () => {
  const { sheets } = useContext(UserContext);
  const { state } = useLocation();
  // Category나 Workspace에서 넘겨받은 sheet, 없으면 Context.sheets[0]로 fallback
  const sheet =
    state?.sheet || (sheets && sheets.length > 0 ? sheets[0] : null);

  const [parsedRows, setParsedRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const revenueChartRef = useRef(null);
  const revenueChartInstance = useRef(null);
  const segmentChartRef = useRef(null);
  const segmentChartInstance = useRef(null);
  const productChartRef = useRef(null);
  const productChartInstance = useRef(null);
  const acqChartRef = useRef(null);
  const acqChartInstance = useRef(null);

  const [activeTimeRange, setActiveTimeRange] = useState("월별");

  // 요약 정보 상태
  const [summary, setSummary] = useState({
    monthlyTotal: 0,
    monthlyPrev: 0,
    newContractTotal: 0,
    newContractPrev: 0,
    avgContract: 0,
    avgContractPrev: 0,
    annualEstimate: 0,
    ytdLastYear: 0,
  });

  // ───────────────────────────────────────────────────────────
  // 1) 시트 데이터 로딩 (B2:H) 및 parsedRows 세팅
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadSheetData = async () => {
      if (!sheet || !window.gapi?.client) return;
      setIsLoading(true);

      try {
        await window.gapi.client.load("sheets", "v4");
        const rangeName = `'제품_판매_기록'!B2:H`;
        const response =
          await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheet.sheetId,
            range: rangeName,
          });
        const values = response.result.values || [];

        const rows = values
          .map((row) => {
            const customerName = row[0]; // B열
            const dateStr = row[2]; // D열
            const amountStr = row[5]; // H열
            if (!customerName || !dateStr || !amountStr) return null;
            const date = parseDate(dateStr);
            const amount = Number(amountStr.replace(/[,₩\s]/g, "")) || 0;
            return { date, amount, customerName };
          })
          .filter((r) => r !== null);

        setParsedRows(rows);
      } catch (err) {
        console.error("시트 로딩 오류:", err);
        setIsLoading(false);
      }
    };

    if (sheet) {
      loadSheetData();
    }

    return () => {
      // 언마운트 시 차트 인스턴스 정리
      [
        revenueChartInstance,
        segmentChartInstance,
        productChartInstance,
        acqChartInstance,
      ].forEach((ref) => {
        if (ref.current) {
          ref.current.destroy();
          ref.current = null;
        }
      });
    };
  }, [sheet, sheets]);

  // ───────────────────────────────────────────────────────────
  // 2) parsedRows 변화 시 요약(summary) 계산 후 isLoading 해제
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (parsedRows.length === 0) {
      setIsLoading(false);
      return;
    }

    const today = new Date();
    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth();

    // 이번 달 총 매출
    const rowsThisMonth = parsedRows.filter(
      ({ date }) =>
        date.getFullYear() === thisYear && date.getMonth() === thisMonth
    );
    const monthlyTotal = rowsThisMonth.reduce(
      (sum, { amount }) => sum + amount,
      0
    );

    // 전월 총 매출
    const rowsPrevMonth = parsedRows.filter(({ date }) => {
      const y = date.getFullYear();
      const m = date.getMonth();
      if (thisMonth === 0) {
        return y === thisYear - 1 && m === 11;
      }
      return y === thisYear && m === thisMonth - 1;
    });
    const monthlyPrev = rowsPrevMonth.reduce(
      (sum, { amount }) => sum + amount,
      0
    );

    // 고객별 첫 구매일 계산
    const firstPurchase = {};
    parsedRows.forEach(({ date, customerName }) => {
      if (!firstPurchase[customerName] || date < firstPurchase[customerName]) {
        firstPurchase[customerName] = date;
      }
    });

    // 이번 달 신규 계약 고객 리스트
    const newCustomersThisMonth = Object.entries(firstPurchase)
      .filter(
        ([_, dt]) =>
          dt.getFullYear() === thisYear && dt.getMonth() === thisMonth
      )
      .map(([cust]) => cust);

    // 이번 달 신규 계약 매출 합
    const newContractTotal = parsedRows
      .filter(
        ({ date, customerName }) =>
          newCustomersThisMonth.includes(customerName) &&
          date.getFullYear() === thisYear &&
          date.getMonth() === thisMonth
      )
      .reduce((sum, { amount }) => sum + amount, 0);

    // 전월 신규 계약 고객 리스트
    const newCustomersPrevMonth = Object.entries(firstPurchase)
      .filter(([_, dt]) => {
        if (thisMonth === 0) {
          return dt.getFullYear() === thisYear - 1 && dt.getMonth() === 11;
        }
        return dt.getFullYear() === thisYear && dt.getMonth() === thisMonth - 1;
      })
      .map(([cust]) => cust);

    // 전월 신규 계약 매출 합
    const newContractPrev = parsedRows
      .filter(({ date, customerName }) => {
        const y = date.getFullYear();
        const m = date.getMonth();
        if (thisMonth === 0) {
          return (
            y === thisYear - 1 &&
            m === 11 &&
            newCustomersPrevMonth.includes(customerName)
          );
        }
        return (
          y === thisYear &&
          m === thisMonth - 1 &&
          newCustomersPrevMonth.includes(customerName)
        );
      })
      .reduce((sum, { amount }) => sum + amount, 0);

    // 이번 달 평균 계약 금액 (건당)
    const avgContract = rowsThisMonth.length
      ? Math.round(monthlyTotal / rowsThisMonth.length)
      : 0;

    // 전월 평균 계약 금액
    const avgContractPrev = rowsPrevMonth.length
      ? Math.round(monthlyPrev / rowsPrevMonth.length)
      : 0;

    // 올해 누적(YTD) 매출
    const rowsThisYear = parsedRows.filter(
      ({ date }) => date.getFullYear() === thisYear
    );
    const ytdTotal = rowsThisYear.reduce((sum, { amount }) => sum + amount, 0);
    const monthsElapsed = thisMonth + 1;
    // 연간 예상 매출
    const annualEstimate = monthsElapsed
      ? Math.round((ytdTotal / monthsElapsed) * 12)
      : 0;

    // 작년 동기(YTD) 매출
    const rowsLastYearToDate = parsedRows.filter(
      ({ date }) =>
        date.getFullYear() === thisYear - 1 && date.getMonth() <= thisMonth
    );
    const ytdLastYear = rowsLastYearToDate.reduce(
      (sum, { amount }) => sum + amount,
      0
    );

    setSummary({
      monthlyTotal,
      monthlyPrev,
      newContractTotal,
      newContractPrev,
      avgContract,
      avgContractPrev,
      annualEstimate,
      ytdLastYear,
    });

    setIsLoading(false);
  }, [parsedRows]);

  // ───────────────────────────────────────────────────────────
  // 3) 매출 추이(Line) 차트 초기화
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!revenueChartRef.current || !parsedRows.length) return;
    if (revenueChartInstance.current) {
      revenueChartInstance.current.destroy();
      revenueChartInstance.current = null;
    }
    const ctx = revenueChartRef.current.getContext("2d");
    revenueChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "총 매출",
            data: [],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.1)",
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "매출 (원)" } },
        },
      },
    });
  }, [parsedRows]);

  // ───────────────────────────────────────────────────────────
  // 4) activeTimeRange 변경 시 매출 차트 업데이트
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!revenueChartInstance.current || !parsedRows.length) return;
    const salesData = parsedRows.map(({ date, amount }) => ({ date, amount }));
    let agg;
    switch (activeTimeRange) {
      case "일별":
        agg = aggregateDaily(salesData);
        break;
      case "주별":
        agg = aggregateWeekly(salesData);
        break;
      case "월별":
        agg = aggregateMonthly(salesData);
        break;
      case "분기별":
        agg = aggregateQuarterly(salesData);
        break;
      case "연간":
        agg = aggregateYearly(salesData);
        break;
      default:
        agg = aggregateMonthly(salesData);
    }
    const chart = revenueChartInstance.current;
    chart.data.labels = agg.labels;
    chart.data.datasets[0].data = agg.values;
    chart.update();
  }, [activeTimeRange, parsedRows]);

  // ───────────────────────────────────────────────────────────
  // 5) 고객 세그먼트·제품 유형·획득/이탈 차트 (더미 데이터)
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    // 고객 세그먼트 Pie
    if (segmentChartRef.current) {
      if (segmentChartInstance.current) {
        segmentChartInstance.current.destroy();
        segmentChartInstance.current = null;
      }
      const ctx = segmentChartRef.current.getContext("2d");
      ctx.canvas.style.backgroundColor = "white";
      segmentChartInstance.current = new Chart(ctx, {
        type: "pie",
        data: {
          labels: ["VIP", "일반", "신규"],
          datasets: [
            {
              label: "고객 세그먼트별 매출",
              data: [450000, 300000, 150000],
              backgroundColor: ["#3b82f6", "#10b981", "#f59e0b"],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ₩${ctx.parsed.toLocaleString()}`,
              },
            },
          },
        },
      });
    }

    // 제품 유형 Pie
    if (productChartRef.current) {
      if (productChartInstance.current) {
        productChartInstance.current.destroy();
        productChartInstance.current = null;
      }
      const ctx = productChartRef.current.getContext("2d");
      ctx.canvas.style.backgroundColor = "white";
      productChartInstance.current = new Chart(ctx, {
        type: "pie",
        data: {
          labels: ["전자제품", "의류", "식료품"],
          datasets: [
            {
              label: "제품 유형별 매출",
              data: [500000, 250000, 200000],
              backgroundColor: ["#6366F1", "#EC4899", "#F43F5E"],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ₩${ctx.parsed.toLocaleString()}`,
              },
            },
          },
        },
      });
    }

    // 획득/이탈 Bar
    if (acqChartRef.current) {
      if (acqChartInstance.current) {
        acqChartInstance.current.destroy();
        acqChartInstance.current = null;
      }
      const ctx = acqChartRef.current.getContext("2d");
      ctx.canvas.style.backgroundColor = "white";
      acqChartInstance.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05"],
          datasets: [
            {
              label: "신규 고객(획득)",
              data: [5, 8, 6, 10, 7],
              backgroundColor: "#10B981",
            },
            {
              label: "이탈 고객",
              data: [1, 2, 3, 1, 2],
              backgroundColor: "#EF4444",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "고객 수" },
            },
          },
        },
      });
    }
  }, [parsedRows]);

  // ───────────────────────────────────────────────────────────
  // JSX 렌더링
  // ───────────────────────────────────────────────────────────
  return (
    <div className="data-analytics-page">
      <Header sheet={sheet} />

      <div className="data-analytics-container">
        <div className="content-area">
          <div className="customer-list-section">
            <h1 className="workspace-title">매출 및 고객/제품 분석</h1>

            {/* (A) 로딩 중 스피너 오버레이 */}
            {isLoading && (
              <div className="loading-message">
                <i className="fas fa-spinner fa-spin"></i>
                <p>매출 분석중...</p>
              </div>
            )}

            {/* (B) 요약 카드 */}
            {!isLoading && (
              <div className="summary-cards">
                {/* 월간 총 매출 */}
                <div className="summary-card">
                  <div className="card-title">월간 총 매출</div>
                  <div className="card-value">
                    ₩{summary.monthlyTotal.toLocaleString()}
                  </div>
                  <div
                    className={`card-change ${
                      summary.monthlyTotal - summary.monthlyPrev >= 0
                        ? "up"
                        : "down"
                    }`}
                  >
                    {summary.monthlyTotal - summary.monthlyPrev >= 0
                      ? "▲ "
                      : "▼ "}
                    {summary.monthlyPrev
                      ? Math.abs(
                          ((summary.monthlyTotal - summary.monthlyPrev) /
                            summary.monthlyPrev) *
                            100
                        ).toFixed(1)
                      : 0}
                    % 지난달 대비
                  </div>
                </div>

                {/* 신규 계약 매출 */}
                <div className="summary-card">
                  <div className="card-title">신규 계약 매출</div>
                  <div className="card-value">
                    ₩{summary.newContractTotal.toLocaleString()}
                  </div>
                  <div
                    className={`card-change ${
                      summary.newContractTotal - summary.newContractPrev >= 0
                        ? "up"
                        : "down"
                    }`}
                  >
                    {summary.newContractTotal - summary.newContractPrev >= 0
                      ? "▲ "
                      : "▼ "}
                    {summary.newContractPrev
                      ? Math.abs(
                          ((summary.newContractTotal -
                            summary.newContractPrev) /
                            summary.newContractPrev) *
                            100
                        ).toFixed(1)
                      : 0}
                    % 지난달 대비
                  </div>
                </div>

                {/* 평균 계약 금액 */}
                <div className="summary-card">
                  <div className="card-title">평균 계약 금액</div>
                  <div className="card-value">
                    ₩{summary.avgContract.toLocaleString()}
                  </div>
                  <div
                    className={`card-change ${
                      summary.avgContract - summary.avgContractPrev >= 0
                        ? "up"
                        : "down"
                    }`}
                  >
                    {summary.avgContract - summary.avgContractPrev >= 0
                      ? "▲ "
                      : "▼ "}
                    {summary.avgContractPrev
                      ? Math.abs(
                          ((summary.avgContract - summary.avgContractPrev) /
                            summary.avgContractPrev) *
                            100
                        ).toFixed(1)
                      : 0}
                    % 지난달 대비
                  </div>
                </div>

                {/* 연간 예상 매출 */}
                <div className="summary-card">
                  <div className="card-title">연간 예상 매출</div>
                  <div className="card-value">
                    ₩{(summary.annualEstimate / 1e9).toFixed(1)}B
                  </div>
                  <div
                    className={`card-change ${
                      summary.annualEstimate - summary.ytdLastYear >= 0
                        ? "up"
                        : "down"
                    }`}
                  >
                    {summary.annualEstimate - summary.ytdLastYear >= 0
                      ? "▲ "
                      : "▼ "}
                    {summary.ytdLastYear
                      ? Math.abs(
                          ((summary.annualEstimate - summary.ytdLastYear) /
                            summary.ytdLastYear) *
                            100
                        ).toFixed(1)
                      : 0}
                    % 작년 대비
                  </div>
                </div>
              </div>
            )}

            {/* (C) 매출 탭 및 차트 */}
            {!isLoading && (
              <>
                {/* 매출 시간 범위 탭 */}
                <div className="data-analytics-time-range-tabs">
                  {["일별", "주별", "월별", "분기별", "연간"].map((range) => (
                    <button
                      key={range}
                      className={`data-analytics-tab-button ${
                        activeTimeRange === range ? "active" : ""
                      }`}
                      onClick={() => setActiveTimeRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                {/* 매출 추이(Line) 차트 */}
                <div className="data-analytics-dashboard-card">
                  <div className="data-analytics-card-header">
                    <h3>매출 추이 ({activeTimeRange})</h3>
                  </div>
                  <div className="data-analytics-chart-container">
                    <canvas ref={revenueChartRef}></canvas>
                  </div>
                </div>

                {/* 고객 세그먼트 Pie 차트 */}
                <div className="data-analytics-dashboard-card">
                  <div className="data-analytics-card-header">
                    <h3>고객 세그먼트별 매출 분포</h3>
                  </div>
                  <div className="data-analytics-chart-container pie-chart">
                    <canvas ref={segmentChartRef}></canvas>
                  </div>
                </div>

                {/* 제품 유형 Pie 차트 */}
                <div className="data-analytics-dashboard-card">
                  <div className="data-analytics-card-header">
                    <h3>제품 유형별 매출 분포</h3>
                  </div>
                  <div className="data-analytics-chart-container pie-chart">
                    <canvas ref={productChartRef}></canvas>
                  </div>
                </div>

                {/* 월별 신규 고객/이탈 Bar 차트 */}
                <div className="data-analytics-dashboard-card">
                  <div className="data-analytics-card-header">
                    <h3>월별 신규 고객(획득) 및 이탈</h3>
                  </div>
                  <div className="data-analytics-chart-container">
                    <canvas ref={acqChartRef}></canvas>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataAnalytics;
