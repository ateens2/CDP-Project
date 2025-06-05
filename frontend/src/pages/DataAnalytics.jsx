// src/pages/DataAnalytics.jsx

import React, { useEffect, useState, useContext, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Chart from "chart.js/auto";
import Header from "../components/Header";
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
  const { user, sheets } = useContext(UserContext);
  const { state } = useLocation();
  // Category나 Workspace에서 넘겨받은 sheet, 없으면 Context.sheets[0]로 fallback
  const sheet =
    state?.sheet || (sheets && sheets.length > 0 ? sheets[0] : null);

  const [parsedRows, setParsedRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [productTypes, setProductTypes] = useState([]);
  // 각 productType별로 체크 여부를 boolean으로 관리
  // (예: { "일회용 컵홀더": true, "고체 향수": false, … })
  const [selectedProductTypes, setSelectedProductTypes] = useState({});

  const revenueChartRef = useRef(null);
  const revenueChartInstance = useRef(null);
  const segmentChartRef = useRef(null);
  const segmentChartInstance = useRef(null);
  const productChartRef = useRef(null);
  const productChartInstance = useRef(null);
  const acqChartRef = useRef(null);
  const acqChartInstance = useRef(null);
  const acqYearlyChartRef = useRef(null);
  const acqYearlyChartInstance = useRef(null);
  const monthlyProductRef = useRef(null);
  const monthlyProductInstance = useRef(null);

  const paretoRef = useRef(null);
  const paretoInstance = useRef(null);

  const growthRef = useRef(null);
  const growthInstance = useRef(null);

  const chartConfigs = [
    {
      key: "productMonthlyTrend",
      title: "제품 월별 추이",
      ref: monthlyProductRef,
    },
    { key: "productPareto", title: "제품 파레토 분석", ref: paretoRef },
    { key: "productGrowth", title: "제품 MoM 증감률", ref: growthRef },
    { key: "productTop5Pie", title: "제품 Top5 분포", ref: productChartRef },
  ];
  const ranges = ["월별", "연간"];
  const [selectedRange, setSelectedRange] = useState("월별");

  // (3) activeChartKey 상태
  const [activeChartKey, setActiveChartKey] = useState(chartConfigs[0].key);

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
        const rangeName = `'제품_판매_기록'!B2:I`;
        const response =
          await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheet.sheetId,
            range: rangeName,
          });
        const values = response.result.values || [];

        const rows = values
          .map((row) => {
            const customerName = row[1]; // B열
            const dateStr = row[3]; // D열
            const productName = row[4];
            const amountStr = row[6]; // H열
            if (!customerName || !productName || !dateStr || !amountStr)
              return null;
            const date = parseDate(dateStr);
            const amount = Number(amountStr.replace(/[,₩\s]/g, "")) || 0;
            return { date, amount, customerName, productName };
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

  useEffect(() => {
    if (!parsedRows || parsedRows.length === 0) return;

    // ─────────────────────────────────────────────────
    // 1) parsedRows에서 고유한 productType만 뽑아 salesMap에 합산
    // ─────────────────────────────────────────────────
    const salesMap = {}; // { [productType]: totalAmount }
    const typesSet = new Set();

    parsedRows.forEach(({ productName, amount }) => {
      if (!productName || isNaN(amount)) return;
      const type = productName.split(",")[0].trim();
      if (!type) return;

      typesSet.add(type);
      salesMap[type] = (salesMap[type] || 0) + amount;
    });

    // 고유 제품 리스트
    const typesArr = Array.from(typesSet).sort();
    setProductTypes(typesArr);

    // ─────────────────────────────────────────────────
    // 2) salesMap을 기준으로, 제품별 총매출 내림차순 정렬 후 상위 1,000개 타입 추출
    // ─────────────────────────────────────────────────
    const sortedBySales = Object.entries(salesMap)
      .sort(([, aAmt], [, bAmt]) => bAmt - aAmt) // 내림차순
      .map(([type]) => type); // [ "제품A", "제품B", … ]

    // 상위 1000개 타입 배열 (제품이 1000개 미만이면 전부 가져옵니다)
    const topHundred = sortedBySales.slice(0, 100);

    // ─────────────────────────────────────────────────
    // 3) selectedProductTypes 초기화: 상위 1000개만 true, 나머지는 false
    // ─────────────────────────────────────────────────
    const initSelected = {};
    typesArr.forEach((type) => {
      initSelected[type] = topHundred.includes(type);
    });
    setSelectedProductTypes(initSelected);
  }, [parsedRows]);

  const toggleProductType = (type) => {
    setSelectedProductTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

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

  // ─── 5) 고객 세그먼트 Pie 차트 추가 ───────────────────────────────
  // DataAnalytics.jsx 내부
  function aggregateMonthlyByProductType(rows) {
    // { [productType]: { [ymKey]: totalAmount } }
    const temp = {};

    rows.forEach(({ date, productName, amount }) => {
      if (!productName) return;
      const productType = productName.split(",")[0].trim();
      if (!productType) return;

      // "YYYY-MM" 키 만들기
      const y = date.getFullYear();
      const m2 = String(date.getMonth() + 1).padStart(2, "0");
      const ymKey = `${y}-${m2}`;

      if (!temp[productType]) {
        temp[productType] = {};
      }
      temp[productType][ymKey] = (temp[productType][ymKey] || 0) + amount;
    });

    // 2) 전체 사용되는 “월(연-월)” 라벨 집합
    const allYMs = new Set();
    Object.values(temp).forEach((obj) => {
      Object.keys(obj).forEach((ym) => allYMs.add(ym));
    });
    const sortedYMs = Array.from(allYMs).sort(); // ["2025-01","2025-02",…] 등

    // 3) Chart.js용 데이터 배열 생성
    //    datasets: [{label: productType, data: [월별매출1, 매출2, …]}, …]
    const datasets = Object.entries(temp).map(([type, salesObj]) => {
      const data = sortedYMs.map((ym) => salesObj[ym] || 0);
      return {
        label: type,
        data,
        // 랜덤 혹은 고정 색상을 지정해도 되고, 차트 라이브러리에 따라 자동으로 배치되기도 함
        // 예시로 랜덤한 RGB 색상을 생성해 봅니다
        borderColor: `rgba(${Math.floor(Math.random() * 200)}, ${Math.floor(
          Math.random() * 200
        )}, ${Math.floor(Math.random() * 200)}, 0.8)`,
        backgroundColor: `rgba(${Math.floor(Math.random() * 200)}, ${Math.floor(
          Math.random() * 200
        )}, ${Math.floor(Math.random() * 200)}, 0.3)`,
        fill: false, // 라인 차트: 선만
        tension: 0.3,
      };
    });

    return { labels: sortedYMs, datasets };
  }
  useEffect(() => {
    if (!monthlyProductRef.current) return;
    if (monthlyProductInstance.current) {
      monthlyProductInstance.current.destroy();
      monthlyProductInstance.current = null;
    }

    // 1) 전체 월별 집계 결과 가져오기
    const { labels, datasets } = aggregateMonthlyByProductType(parsedRows);

    // 2) datasets 중 selectedProductTypes[type]이 true인 것만 필터링
    const filteredDatasets = datasets.filter(
      (ds) => selectedProductTypes[ds.label]
    );

    const ctx = monthlyProductRef.current.getContext("2d");
    ctx.canvas.style.backgroundColor = "white";

    monthlyProductInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: filteredDatasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ₩${ctx.parsed.y.toLocaleString()}`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "연-월" },
            ticks: { maxRotation: 45, minRotation: 45, autoSkip: true },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "매출 (원)" },
            ticks: { callback: (v) => `₩${v.toLocaleString()}` },
          },
        },
      },
    });
  }, [parsedRows, selectedProductTypes, activeChartKey]);

  // (2) 제품 매출 파레토 분석 차트
  function calculateParetoData(rows) {
    // 카테고리별 총매출 계산
    const productAggregates = {};
    rows.forEach(({ productName, amount }) => {
      if (!productName) return;
      const type = productName.split(",")[0].trim();
      if (!type) return;
      productAggregates[type] = (productAggregates[type] || 0) + amount;
    });

    // 내림차순 정렬
    const sorted = Object.entries(productAggregates)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = sorted.reduce((sum, item) => sum + item.total, 0);

    // 2) 각 항목별 비중, 누적 비중 계산
    let cumulative = 0;
    const labels = [];
    const barData = [];
    const lineData = []; // 누적 비중

    sorted.forEach(({ type, total }) => {
      const pct = (total / grandTotal) * 100;
      cumulative += pct;

      labels.push(type);
      barData.push(pct.toFixed(2)); // 개별 비중(%)
      lineData.push(cumulative.toFixed(2)); // 누적 비중(%)
    });

    return { labels, barData, lineData };
  }
  useEffect(() => {
    if (!paretoRef.current) return;
    if (paretoInstance.current) {
      paretoInstance.current.destroy();
      paretoInstance.current = null;
    }
    const { labels, barData, lineData } = calculateParetoData(parsedRows);
    const ctx = paretoRef.current.getContext("2d");
    ctx.canvas.style.backgroundColor = "white";
    paretoInstance.current = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "제품 비중 (%)",
            yAxisID: "yBar",
            data: barData,
            backgroundColor: "#3b82f6",
          },
          {
            type: "line",
            label: "누적 비중 (%)",
            yAxisID: "yLine",
            data: lineData,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239,68,68,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }, [parsedRows, activeChartKey]);

  // (3) MoM 매출 증감률 차트
  function calculateMonthlyGrowthByProductType(rows) {
    const { labels: allYMs, datasets } = aggregateMonthlyByProductType(rows);
    // allYMs = ["2025-01","2025-02",...], datasets = [{label: type, data: [월별매출,…]}, ...]

    // 마지막 2개 월(또는 특정 두 월)만 비교한다고 가정
    const n = allYMs.length;
    if (n < 2) {
      return { labels: [], growthData: [] };
    }
    const prevMonth = allYMs[n - 2];
    const currentMonth = allYMs[n - 1];

    // growthData: [{ type: "A", rate: 12.5 }, …]
    const growthData = datasets.map(({ label: type, data }) => {
      const prevVal = data[n - 2] || 0;
      const currVal = data[n - 1] || 0;
      const rate =
        prevVal === 0
          ? currVal === 0
            ? 0
            : 100 // 전월이 0원인데 당월이 매출이 있으면 100%
          : ((currVal - prevVal) / prevVal) * 100;
      return { type, rate: +rate.toFixed(2) };
    });

    return { prevMonth, currentMonth, growthData };
  }
  useEffect(() => {
    if (!growthRef.current) return;
    if (growthInstance.current) {
      growthInstance.current.destroy();
      growthInstance.current = null;
    }
    const { prevMonth, currentMonth, growthData } =
      calculateMonthlyGrowthByProductType(parsedRows);
    const labels = growthData.map((item) => item.type);
    const data = growthData.map((item) => item.rate);
    const ctx = growthRef.current.getContext("2d");
    ctx.canvas.style.backgroundColor = "white";
    growthInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: `${prevMonth} → ${currentMonth} 매출 증감률(%)`,
            data,
            backgroundColor: data.map((v) => (v >= 0 ? "#10b981" : "#ef4444")),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }, [parsedRows, activeChartKey]);

  // (4) 제품 Top5 Pie 차트
  useEffect(() => {
    if (!productChartRef.current) return;
    if (productChartInstance.current) {
      productChartInstance.current.destroy();
      productChartInstance.current = null;
    }
    const { labels, data } = calculateProductTypeDistribution(parsedRows);
    const ctx = productChartRef.current.getContext("2d");
    ctx.canvas.style.backgroundColor = "white";
    productChartInstance.current = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            label: "Top5 + 기타",
            data,
            backgroundColor: [
              "#6366F1",
              "#EC4899",
              "#F43F5E",
              "#10B981",
              "#F59E0B",
              "#9CA3AF",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }, [parsedRows, activeChartKey]);

  /**
   * 1) parsedRows: [{ date, amount, customerName, productName }, …]
   * 2) Recency: “오늘”(기준일) 기준 마지막 구매까지의 일수 (작을수록 좋음)
   * 3) Frequency: 총 구매 횟수 (클수록 좋음)
   * 4) Monetary: 총 구매 금액 (클수록 좋음)
   * 5) 각 지표별로 5분위(quantile) 기준 점수(1~5) 부여 → RFM_Score 합산
   * 6) RFM_Score 기준으로 세그먼트 구분 (VIP/Gold/Silver/Bronze)
   * 7) 세그먼트별 누적 매출 합계 리턴
   */
  function calculateCustomerSegments(rows) {
    // 1) 오늘을 기준일로 삼아서 날짜 계산
    const today = new Date();

    // 2) 고객별 RFM raw 집계 객체 생성
    //    { [customerName]: { lastDate: Date, freq: number, monetary: number } }
    const raw = {};
    rows.forEach(({ customerName, date, amount }) => {
      if (!customerName || !date || isNaN(amount)) return;

      if (!raw[customerName]) {
        raw[customerName] = {
          lastDate: date,
          freq: 0,
          monetary: 0,
        };
      }
      // Recency를 위해 가장 최신 날짜만 저장
      if (date > raw[customerName].lastDate) {
        raw[customerName].lastDate = date;
      }
      raw[customerName].freq += 1;
      raw[customerName].monetary += amount;
    });

    // 3) 고객별 Recency, Frequency, Monetary 배열 추출
    const customers = Object.keys(raw);
    if (customers.length === 0) {
      return { labels: [], data: [] };
    }

    const recencyArr = []; // 일수 배열
    const frequencyArr = [];
    const monetaryArr = [];

    customers.forEach((cust) => {
      const { lastDate, freq, monetary } = raw[cust];
      // (today - lastDate) 일수 계산
      const diffMs = today.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      recencyArr.push(diffDays);
      frequencyArr.push(freq);
      monetaryArr.push(monetary);
    });

    // 4) 각 지표 5분위(quantile) 경계값 계산 함수
    function quantile(arr, q) {
      const sorted = arr.slice().sort((a, b) => a - b);
      const pos = (sorted.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (sorted[base + 1] !== undefined) {
        return sorted[base] + (sorted[base + 1] - sorted[base]) * rest;
      } else {
        return sorted[base];
      }
    }

    // Recency는 값이 작을수록 좋으므로 '낮은 값 = 높은 점수' 매핑
    // Frequency, Monetary는 값이 클수록 좋음('높은 값 = 높은 점수')
    const recencyQ = [
      quantile(recencyArr, 0.2),
      quantile(recencyArr, 0.4),
      quantile(recencyArr, 0.6),
      quantile(recencyArr, 0.8),
    ];
    const frequencyQ = [
      quantile(frequencyArr, 0.2),
      quantile(frequencyArr, 0.4),
      quantile(frequencyArr, 0.6),
      quantile(frequencyArr, 0.8),
    ];
    const monetaryQ = [
      quantile(monetaryArr, 0.2),
      quantile(monetaryArr, 0.4),
      quantile(monetaryArr, 0.6),
      quantile(monetaryArr, 0.8),
    ];

    // 5) 점수 부여 함수 (Recency는 reverse, 나머지는 그대로)
    function getRecencyScore(val) {
      if (val <= recencyQ[0]) return 5;
      if (val <= recencyQ[1]) return 4;
      if (val <= recencyQ[2]) return 3;
      if (val <= recencyQ[3]) return 2;
      return 1;
    }
    function getFrequencyScore(val) {
      if (val <= frequencyQ[0]) return 1;
      if (val <= frequencyQ[1]) return 2;
      if (val <= frequencyQ[2]) return 3;
      if (val <= frequencyQ[3]) return 4;
      return 5;
    }
    function getMonetaryScore(val) {
      if (val <= monetaryQ[0]) return 1;
      if (val <= monetaryQ[1]) return 2;
      if (val <= monetaryQ[2]) return 3;
      if (val <= monetaryQ[3]) return 4;
      return 5;
    }

    // 6) 고객별 RFM Score 계산 및 세그먼트 결정
    //    segments → {"VIP": { total: 0, count: 0 }, ...}
    const segments = {
      VIP: { total: 0, count: 0 },
      Gold: { total: 0, count: 0 },
      Silver: { total: 0, count: 0 },
      Bronze: { total: 0, count: 0 },
    };

    customers.forEach((cust, idx) => {
      const { lastDate, freq, monetary } = raw[cust];
      // Recency 별도 계산
      const diffMs = today.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const R = getRecencyScore(diffDays);
      const F = getFrequencyScore(freq);
      const M = getMonetaryScore(monetary);
      const RFM = R + F + M;

      // 세그먼트 룰: 합산 점수 기준
      let segmentLabel;
      if (RFM >= 13) {
        segmentLabel = "VIP";
      } else if (RFM >= 10) {
        segmentLabel = "Gold";
      } else if (RFM >= 7) {
        segmentLabel = "Silver";
      } else {
        segmentLabel = "Bronze";
      }

      // 해당 고객의 총 매출(monetary)을 세그먼트별로 더해둠
      segments[segmentLabel].total += monetary;
      segments[segmentLabel].count += 1;
    });

    // 7) 차트용 labels/data 배열 생성
    const labels = [];
    const data = [];

    Object.entries(segments).forEach(([label, { total }]) => {
      // 매출이 0인 세그먼트는 제외하고 싶다면 if(total>0) 체크
      labels.push(label);
      data.push(total);
    });

    return { labels, data };
  }

  useEffect(() => {
    if (!segmentChartRef.current) return;
    if (segmentChartInstance.current) {
      segmentChartInstance.current.destroy();
      segmentChartInstance.current = null;
    }
    const { labels, data } = calculateCustomerSegments(parsedRows);
    const ctx = segmentChartRef.current.getContext("2d");
    ctx.canvas.style.backgroundColor = "white";
    segmentChartInstance.current = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            label: "고객 세그먼트별 매출",
            data,
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
  }, [parsedRows]);

  // ─── 6) 제품 유형 Pie 차트 추가 ────────────────────────────────────
  function calculateProductTypeDistribution(rows) {
    // 1) 원래 집계: { [productType]: totalAmount }
    const productAggregates = {};
    rows.forEach(({ productName, amount }) => {
      if (!productName || typeof productName !== "string") return;
      const productType = productName.split(",")[0].trim();
      if (!productType) return;

      if (!productAggregates[productType]) {
        productAggregates[productType] = 0;
      }
      productAggregates[productType] += amount;
    });

    // 2) 집계 결과를 배열로 변환한 뒤 내림차순 정렬
    //    [{ type: "A", total: 50000 }, { type: "B", total: 30000 }, …]
    const sorted = Object.entries(productAggregates)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    // 3) 상위 5개 추출
    const top5 = sorted.slice(0, 5);

    // 4) 나머지는 기타로 합산
    const othersTotal = sorted
      .slice(5)
      .reduce((sum, item) => sum + item.total, 0);

    // 5) Pie 차트용 labels/data 배열 생성
    const labels = top5.map((item) => item.type);
    const data = top5.map((item) => item.total);

    // “기타”가 있을 때에만 추가
    if (othersTotal > 0) {
      labels.push("기타");
      data.push(othersTotal);
    }

    return { labels, data };
  }

  useEffect(() => {
    if (!productChartRef.current) return;
    if (productChartInstance.current) {
      productChartInstance.current.destroy();
      productChartInstance.current = null;
    }
    const { labels, data } = calculateProductTypeDistribution(parsedRows);
    const ctx = productChartRef.current.getContext("2d");
    ctx.canvas.style.backgroundColor = "white";
    productChartInstance.current = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            label: "제품 유형별 매출",
            data,
            backgroundColor: [
              "#6366F1",
              "#EC4899",
              "#F43F5E",
              "#10B981",
              "#F59E0B",
            ],
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
              label: (ctx) => `₩${ctx.parsed.toLocaleString()}`,
            },
          },
        },
      },
    });
  }, [parsedRows]);

  function countNewCustomersByYear(rows) {
    const firstPurchase = {};
    rows.forEach(({ customerName, date }) => {
      if (!firstPurchase[customerName] || date < firstPurchase[customerName]) {
        firstPurchase[customerName] = date;
      }
    });
    const bucket = {};
    Object.values(firstPurchase).forEach((dt) => {
      const y = dt.getFullYear().toString();
      bucket[y] = (bucket[y] || 0) + 1;
    });
    const labels = Object.keys(bucket).sort();
    const values = labels.map((k) => bucket[k]);
    return { labels, values };
  }

  function countChurnCustomersByYear(rows) {
    const purchaseByCustomer = {};
    rows.forEach(({ customerName, date }) => {
      const y = date.getFullYear();
      if (!purchaseByCustomer[customerName]) {
        purchaseByCustomer[customerName] = new Set();
      }
      purchaseByCustomer[customerName].add(y);
    });

    const churnBucket = {};
    Object.values(purchaseByCustomer).forEach((yearsSet) => {
      Array.from(yearsSet).forEach((year) => {
        const nextYear = year + 1;
        // 다음 연도에 구매 기록이 없으면 “이 연도에 이탈”로 간주
        if (!yearsSet.has(nextYear)) {
          const key = year.toString();
          churnBucket[key] = (churnBucket[key] || 0) + 1;
        }
      });
    });

    const labels = Object.keys(churnBucket).sort();
    const values = labels.map((k) => churnBucket[k]);
    return { labels, values };
  }

  useEffect(() => {
    if (!acqYearlyChartRef.current) return;

    // 기존 차트가 있으면 파기
    if (acqYearlyChartInstance.current) {
      acqYearlyChartInstance.current.destroy();
      acqYearlyChartInstance.current = null;
    }

    // (3-1) 연별 신규 데이터
    const { labels: newLabelsY, values: newValuesY } =
      countNewCustomersByYear(parsedRows);
    // (3-2) 연별 이탈 데이터
    const { labels: churnLabelsY, values: churnValuesY } =
      countChurnCustomersByYear(parsedRows);

    // (3-3) 레이블 합집합 → 정렬
    const allLabelsY_Set = new Set([...newLabelsY, ...churnLabelsY]);
    const sortedAllLabelsY = Array.from(allLabelsY_Set).sort();

    // (3-4) 값 매핑 (없으면 0)
    const finalNewDataY = sortedAllLabelsY.map((key) =>
      newLabelsY.includes(key) ? newValuesY[newLabelsY.indexOf(key)] : 0
    );
    const finalChurnDataY = sortedAllLabelsY.map((key) =>
      churnLabelsY.includes(key) ? churnValuesY[churnLabelsY.indexOf(key)] : 0
    );

    const ctxY = acqYearlyChartRef.current.getContext("2d");
    ctxY.canvas.style.backgroundColor = "white";
    acqYearlyChartInstance.current = new Chart(ctxY, {
      type: "bar",
      data: {
        labels: sortedAllLabelsY,
        datasets: [
          {
            label: "신규 고객(획득)",
            data: finalNewDataY,
            backgroundColor: "#10B981",
          },
          {
            label: "이탈 고객",
            data: finalChurnDataY,
            backgroundColor: "#F43F5E",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "연도" },
          },
          y: {
            title: { display: true, text: "고객 수" },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });
  }, [parsedRows]);

  // ───────────────────────────────────────────────────────────
  // JSX 렌더링
  // ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="customer-management">
        <Header />
        <div className="main-content">
          <p>로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }
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
                <div className="data-analytics-dashboard-card">
                  <div className="data-analytics-card-header">
                    <h3>고객 세그먼트별 매출 분포</h3>
                  </div>

                  {/* Flex wrapper: 왼쪽 차트, 오른쪽 설명 */}
                  <div className="segment-chart-wrapper">
                    {/* ─────────────── 왼쪽: Pie 차트 영역 ─────────────── */}
                    <div className="segment-chart-container">
                      <canvas ref={segmentChartRef}></canvas>
                    </div>

                    {/* ─────────────── 오른쪽: 계산 방식 설명 ─────────────── */}
                    <div className="segment-description">
                      <h4>RFM 기반 계산 방법</h4>
                      <ol>
                        <li>
                          <strong>Recency (최근성)</strong>
                          <br />‣ 각 고객의 <em>마지막 구매 일자</em>로부터
                          “오늘”까지의 <em>경과 일수</em>를 계산합니다.
                          <br />
                          작은 숫자일수록 “가까운 시점”에 구매했다는 의미이므로
                          높은 점수를 부여합니다.
                        </li>
                        <li>
                          <strong>Frequency (빈도)</strong>
                          <br />‣ 해당 고객의 <em>총 주문 횟수</em>를 세어서,
                          많이 구매한 고객에게 높은 점수를 부여합니다.
                        </li>
                        <li>
                          <strong>Monetary (금액)</strong>
                          <br />‣ 해당 고객의 <em>총 매출액(구매 금액 합계)</em>
                          을 계산하여, 높은 매출 고객에게 높은 점수를
                          부여합니다.
                        </li>
                        <li>
                          <strong>각 지표별 점수 부여 (1~5점)</strong>
                          <br />
                          ‣ 5분위수(quantile) 기준으로 상위 20% → 5점, …, 하위
                          20% → 1점을 부여합니다.
                          <br />• <em>Recency</em>는 “작을수록 좋으므로” 값이
                          작을수록 5점, 클수록 1점
                          <br />• <em>Frequency, Monetary</em>는 “클수록
                          좋으므로” 값이 클수록 5점, 작을수록 1점
                        </li>
                        <li>
                          <strong>RFM 점수 합산 → 세그먼트 결정</strong>
                          <br />‣ 고객별{" "}
                          <code>R_score + F_score + M_score</code> 합산 결과가:
                          <br />
                          &nbsp;&nbsp;• 13점 이상 → VIP
                          <br />
                          &nbsp;&nbsp;• 10~12점 → Gold
                          <br />
                          &nbsp;&nbsp;• 7~9점 → Silver
                          <br />
                          &nbsp;&nbsp;• 그 외 (≤6점) → Bronze
                        </li>
                        <li>
                          <strong>세그먼트별 매출 합산</strong>
                          <br />‣ 최종적으로 각 고객이 속한 세그먼트(**VIP,
                          Gold, Silver, Bronze**)별로 그 고객의{" "}
                          <em>총 매출액</em>을 합산하여 파이 차트를 그립니다.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="chart-selector-buttons">
                  {chartConfigs.map(({ key, title }) => (
                    <button
                      key={key}
                      className={`selector-button ${
                        activeChartKey === key ? "active" : ""
                      }`}
                      onClick={() => setActiveChartKey(key)}
                    >
                      {title}
                    </button>
                  ))}
                </div>

                {/* (C) 제품 분석 차트 렌더링 (수정된 매핑) */}
                {chartConfigs.map(({ key, title, ref }) => {
                  if (key !== activeChartKey) return null;
                  return (
                    <div className="data-analytics-dashboard-card" key={key}>
                      <div className="data-analytics-card-header">
                        <h3>{title}</h3>
                      </div>

                      {key === "productMonthlyTrend" ? (
                        <div className="monthly-wrapper">
                          {/* ── 왼쪽: 월별 차트 ── */}
                          <div className="monthly-chart-container">
                            <canvas ref={monthlyProductRef}></canvas>
                          </div>

                          {/* ── 오른쪽: 체크박스 + 설명 ── */}
                          <div className="monthly-checkbox-container">
                            {/* 체크박스 목록 전용 스크롤 영역 */}
                            <div className="product-checkbox-wrapper">
                              {productTypes.map((type) => (
                                <label
                                  key={type}
                                  className="product-checkbox-label"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!selectedProductTypes[type]}
                                    onChange={() => toggleProductType(type)}
                                  />
                                  {type}
                                </label>
                              ))}
                            </div>

                            {/* 체크박스 리스트 아래 고정 설명 */}
                            <div className="monthly-description">
                              판매량 상위 100개 제품이 기본적으로
                              체크되어있습니다.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="data-analytics-chart-container">
                          <canvas ref={ref}></canvas>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* 연간 신규 고객/이탈 Bar 차트 */}
                <div className="data-analytics-dashboard-card">
                  <div className="data-analytics-card-header">
                    <h3>연간 신규 고객(획득) 및 이탈</h3>
                  </div>
                  <div className="data-analytics-chart-container">
                    <canvas ref={acqYearlyChartRef} />
                  </div>
                  <div className="data-analytics-explanation">
                    <p>
                      • 신규 고객: 해당 연도에 첫 구매를 한 고객 수를
                      의미합니다. <br />• 이탈 고객: 해당 연도에 구매했지만 다음
                      연도에 재구매 기록이 없는 고객 수를 의미합니다.
                    </p>
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
