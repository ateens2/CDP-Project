import React, { useEffect, useRef, useState, useContext } from "react";
import { useLocation } from "react-router-dom";
import Category from "../components/Category";
import Header from "../components/Header";
import Chart from "chart.js/auto";
import { UserContext } from "../contexts/UserContext";
import "./DataAnalytics.css";

const DataAnalytics = () => {
  // location과 UserContext 추가
  const { state } = useLocation();
  const sheet = state?.sheet;
  const { user, sheets } = useContext(UserContext);

  // 시트 정보 상태 추가
  const [sheetData, setSheetData] = useState(null);

  // 차트용 ref 선언
  const revenueChartRef = useRef(null);
  const segmentChartRef = useRef(null);
  const productChartRef = useRef(null);
  const acquisitionChartRef = useRef(null);

  // 차트 인스턴스 저장 refs
  const revenueChartInstance = useRef(null);
  const segmentChartInstance = useRef(null);
  const productChartInstance = useRef(null);
  const acquisitionChartInstance = useRef(null);

  // 활성 탭 상태 관리
  const [activeTab, setActiveTab] = useState("매출 분석");
  const [activeTimeRange, setActiveTimeRange] = useState("월별");

  useEffect(() => {
    // 시트 데이터 로드
    const loadSheetData = async () => {
      if (!sheet || !window.gapi?.client) return;

      try {
        await window.gapi.client.load("sheets", "v4");
        const meta = await window.gapi.client.sheets.spreadsheets.get({
          spreadsheetId: sheet.sheetId,
        });

        // 시트 정보 설정
        setSheetData({
          id: sheet.sheetId,
          title: sheet.name,
          meta: meta.result,
        });

        console.log("시트 데이터 로드 완료:", sheet.name);
      } catch (error) {
        console.error("시트 데이터 로드 오류:", error);
      }
    };

    // 시트 정보가 있으면 로드
    if (sheet) {
      loadSheetData();
    } else if (sheets && sheets.length > 0) {
      // UserContext에서 시트 정보 활용
      setSheetData({
        id: sheets[0].sheetId,
        title: sheets[0].name,
      });
    }

    // 기존 차트 인스턴스 정리
    if (revenueChartInstance.current) {
      revenueChartInstance.current.destroy();
      revenueChartInstance.current = null;
    }
    if (segmentChartInstance.current) {
      segmentChartInstance.current.destroy();
      segmentChartInstance.current = null;
    }
    if (productChartInstance.current) {
      productChartInstance.current.destroy();
      productChartInstance.current = null;
    }
    if (acquisitionChartInstance.current) {
      acquisitionChartInstance.current.destroy();
      acquisitionChartInstance.current = null;
    }

    // 1. 매출 트렌드 차트
    if (revenueChartRef.current) {
      const ctx = revenueChartRef.current.getContext("2d");

      // 캔버스 기본 스타일 설정
      ctx.canvas.style.backgroundColor = "white";
      ctx.canvas.style.width = "100%";
      ctx.canvas.style.height = "100%";

      revenueChartInstance.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: [
            "1월",
            "2월",
            "3월",
            "4월",
            "5월",
            "6월",
            "7월",
            "8월",
            "9월",
            "10월",
            "11월",
            "12월",
          ],
          datasets: [
            {
              label: "실제 매출",
              data: [
                320, 350, 390, 410, 450, 480, 510, 520, 480, 430, 410, 450,
              ],
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59,130,246,0.1)",
              tension: 0.3,
              fill: true,
            },
            {
              label: "예상 매출",
              data: [
                330, 360, 370, 400, 440, 470, 500, 530, 490, 450, 430, 460,
              ],
              borderColor: "#93c5fd",
              borderDash: [5, 5],
              tension: 0.3,
              fill: false,
            },
            {
              label: "전년 동기",
              data: [
                280, 310, 340, 370, 380, 410, 430, 450, 420, 390, 380, 400,
              ],
              borderColor: "#10b981",
              tension: 0.3,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: false,
              title: { display: true, text: "매출 (백만원)" },
            },
          },
        },
      });
    }

    // 2. 고객 세그먼트별 매출 (도넛)
    if (segmentChartRef.current) {
      const ctx = segmentChartRef.current.getContext("2d");

      // 캔버스 기본 스타일 설정
      ctx.canvas.style.backgroundColor = "white";
      ctx.canvas.style.width = "100%";
      ctx.canvas.style.height = "100%";

      segmentChartInstance.current = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["대기업", "중견기업", "중소기업", "스타트업", "공공기관"],
          datasets: [
            {
              data: [35, 25, 20, 15, 5],
              backgroundColor: [
                "#3b82f6",
                "#60a5fa",
                "#93c5fd",
                "#bfdbfe",
                "#dbeafe",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "right" },
          },
        },
      });
    }

    // 3. 제품 유형별 매출 (바 차트)
    if (productChartRef.current) {
      const ctx = productChartRef.current.getContext("2d");

      // 캔버스 기본 스타일 설정
      ctx.canvas.style.backgroundColor = "white";
      ctx.canvas.style.width = "100%";
      ctx.canvas.style.height = "100%";

      productChartInstance.current = new Chart(ctx, {
        type: "bar",
        data: {
          labels: [
            "SaaS 기본형",
            "SaaS 프리미엄",
            "CSAP 스탠다드",
            "CSAP 엔터프라이즈",
            "컨설팅 서비스",
          ],
          datasets: [
            {
              label: "매출 비중",
              data: [25, 32, 18, 15, 10],
              backgroundColor: [
                "#3b82f6",
                "#60a5fa",
                "#93c5fd",
                "#bfdbfe",
                "#dbeafe",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "매출 비중 (%)" },
            },
          },
        },
      });
    }

    // 4. 고객 획득 및 이탈 차트
    if (acquisitionChartRef.current) {
      const ctx = acquisitionChartRef.current.getContext("2d");

      // 캔버스 기본 스타일 설정
      ctx.canvas.style.backgroundColor = "white";
      ctx.canvas.style.width = "100%";
      ctx.canvas.style.height = "100%";

      acquisitionChartInstance.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: [
            "1월",
            "2월",
            "3월",
            "4월",
            "5월",
            "6월",
            "7월",
            "8월",
            "9월",
            "10월",
            "11월",
            "12월",
          ],
          datasets: [
            {
              label: "신규 고객",
              data: [12, 15, 18, 21, 19, 22, 25, 28, 24, 20, 22, 26],
              borderColor: "#10b981",
              backgroundColor: "rgba(16,185,129,0.1)",
              tension: 0.3,
              fill: true,
            },
            {
              label: "이탈 고객",
              data: [5, 6, 4, 7, 8, 10, 7, 6, 5, 9, 8, 7],
              borderColor: "#ef4444",
              backgroundColor: "rgba(239,68,68,0.1)",
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "고객 수" },
            },
          },
        },
      });
    }

    // 컴포넌트 언마운트 시 차트 인스턴스 정리
    return () => {
      if (revenueChartInstance.current) {
        revenueChartInstance.current.destroy();
        revenueChartInstance.current = null;
      }
      if (segmentChartInstance.current) {
        segmentChartInstance.current.destroy();
        segmentChartInstance.current = null;
      }
      if (productChartInstance.current) {
        productChartInstance.current.destroy();
        productChartInstance.current = null;
      }
      if (acquisitionChartInstance.current) {
        acquisitionChartInstance.current.destroy();
        acquisitionChartInstance.current = null;
      }
    };
  }, [sheet, sheets]);

  // 시간 범위 변경 시 차트 업데이트
  useEffect(() => {
    // 예시 데이터 - 실제 구현에서는 API 요청이나 다른 데이터 소스에서 가져올 수 있음
    const timeRangeData = {
      월별: {
        revenue: [320, 350, 390, 410, 450, 480, 510, 520, 480, 430, 410, 450],
        expected: [330, 360, 370, 400, 440, 470, 500, 530, 490, 450, 430, 460],
        lastYear: [280, 310, 340, 370, 380, 410, 430, 450, 420, 390, 380, 400],
        labels: [
          "1월",
          "2월",
          "3월",
          "4월",
          "5월",
          "6월",
          "7월",
          "8월",
          "9월",
          "10월",
          "11월",
          "12월",
        ],
      },
      분기별: {
        revenue: [1060, 1440, 1510, 1290],
        expected: [1060, 1410, 1520, 1340],
        lastYear: [930, 1220, 1300, 1170],
        labels: ["1분기", "2분기", "3분기", "4분기"],
      },
      연간: {
        revenue: [4200, 4800, 5300, 5800, 6300],
        expected: [4300, 4900, 5400, 5900, 6500],
        lastYear: [3900, 4300, 4700, 5200, 5800],
        labels: ["2020년", "2021년", "2022년", "2023년", "2024년(예상)"],
      },
    };

    // 차트 인스턴스가 존재하면 데이터 업데이트
    if (revenueChartInstance.current) {
      const data = timeRangeData[activeTimeRange];
      const chart = revenueChartInstance.current;

      // 데이터 및 라벨 업데이트
      chart.data.labels = data.labels;
      chart.data.datasets[0].data = data.revenue;
      chart.data.datasets[1].data = data.expected;
      chart.data.datasets[2].data = data.lastYear;

      // 차트 갱신
      chart.update();
    }
  }, [activeTimeRange]);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const handleTimeRangeClick = (range) => {
    setActiveTimeRange(range);
  };

  return (
    <div>
      <Header />
      <div className="data-analytics-container">
        <div className="content-area">
          <div className="category-section">
            <Category sheet={sheet} />
          </div>
          <div className="customer-list-section">
            <h1 className="workspace-title">매출 분석</h1>

            {/* 타임 레인지 필터 */}
            <div className="data-analytics-time-range-tabs">
              <button
                className={`data-analytics-tab-button ${
                  activeTimeRange === "일별" ? "active" : ""
                }`}
              >
                일별
              </button>
              <button
                className={`data-analytics-tab-button ${
                  activeTimeRange === "주별" ? "active" : ""
                }`}
              >
                주별
              </button>
              <button
                className={`data-analytics-tab-button ${
                  activeTimeRange === "월별" ? "active" : ""
                }`}
              >
                월별
              </button>
              <button
                className={`data-analytics-tab-button ${
                  activeTimeRange === "분기별" ? "active" : ""
                }`}
              >
                분기별
              </button>
              <button
                className={`data-analytics-tab-button ${
                  activeTimeRange === "연간" ? "active" : ""
                }`}
              >
                연간
              </button>
            </div>

            {/* 메트릭 카드 */}
            <div className="data-analytics-metrics-grid">
              <div className="data-analytics-metric-card">
                <div className="data-analytics-metric-title">총 매출</div>
                <div className="data-analytics-metric-value">4,800만원</div>
                <div className="data-analytics-metric-trend data-analytics-trend-up">
                  <i className="fas fa-arrow-up"></i> 12.5% 상승
                </div>
              </div>
              <div className="data-analytics-metric-card">
                <div className="data-analytics-metric-title">
                  평균 거래 금액
                </div>
                <div className="data-analytics-metric-value">120만원</div>
                <div className="data-analytics-metric-trend data-analytics-trend-up">
                  <i className="fas fa-arrow-up"></i> 5.2% 상승
                </div>
              </div>
              <div className="data-analytics-metric-card">
                <div className="data-analytics-metric-title">신규 고객 수</div>
                <div className="data-analytics-metric-value">24</div>
                <div className="data-analytics-metric-trend data-analytics-trend-up">
                  <i className="fas fa-arrow-up"></i> 8.7% 상승
                </div>
              </div>
              <div className="data-analytics-metric-card">
                <div className="data-analytics-metric-title">고객 이탈율</div>
                <div className="data-analytics-metric-value">2.3%</div>
                <div className="data-analytics-metric-trend data-analytics-trend-down">
                  <i className="fas fa-arrow-down"></i> 1.1% 감소
                </div>
              </div>
            </div>

            {/* 차트 섹션 */}
            <div className="data-analytics-dashboard-card">
              <div className="data-analytics-card-header">
                <h3>월별 매출 추이</h3>
              </div>
              <div className="data-analytics-chart-container">
                <canvas ref={revenueChartRef}></canvas>
                <div className="data-analytics-chart-legend">
                  <div className="data-analytics-legend-item">
                    <div className="data-analytics-legend-dot data-analytics-bg-blue-500"></div>
                    <span className="data-analytics-legend-text">
                      실제 매출
                    </span>
                  </div>
                  <div className="data-analytics-legend-item">
                    <div className="data-analytics-legend-dot data-analytics-bg-blue-300"></div>
                    <span className="data-analytics-legend-text">
                      예상 매출
                    </span>
                  </div>
                  <div className="data-analytics-legend-item">
                    <div className="data-analytics-legend-dot data-analytics-bg-green-500"></div>
                    <span className="data-analytics-legend-text">
                      전년 동기
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 세그먼트별 매출 */}
            <div className="data-analytics-segment-grid">
              <div className="data-analytics-dashboard-card">
                <div className="data-analytics-card-header">
                  <h3>고객 세그먼트별 매출</h3>
                </div>
                <div className="data-analytics-chart-container">
                  <canvas ref={segmentChartRef}></canvas>
                </div>
              </div>
              <div className="data-analytics-dashboard-card">
                <div className="data-analytics-card-header">
                  <h3>제품 유형별 매출</h3>
                </div>
                <div className="data-analytics-chart-container">
                  <canvas ref={productChartRef}></canvas>
                </div>
              </div>
            </div>

            {/* 고객 획득 및 이탈 분석 차트 */}
            <div className="data-analytics-dashboard-card">
              <div className="data-analytics-card-header">
                <h3>고객 획득 및 이탈 분석</h3>
              </div>
              <div className="data-analytics-acquisition-container">
                <div className="data-analytics-acquisition-chart">
                  <canvas ref={acquisitionChartRef}></canvas>
                </div>

                {/* 분석 요인 설명 */}
                <div className="data-analytics-analysis-factors">
                  <h4>주요 고객 이탈 원인</h4>
                  <div className="data-analytics-factor-bars">
                    <div className="data-analytics-factor-bar-item">
                      <div className="data-analytics-factor-bar-label">
                        가격 경쟁력 부족
                      </div>
                      <div className="data-analytics-factor-bar-container">
                        <div
                          className="data-analytics-factor-bar"
                          style={{ width: "38%" }}
                        ></div>
                        <div className="data-analytics-factor-bar-percent">
                          38%
                        </div>
                      </div>
                    </div>
                    <div className="data-analytics-factor-bar-item">
                      <div className="data-analytics-factor-bar-label">
                        기능 요구사항 불일치
                      </div>
                      <div className="data-analytics-factor-bar-container">
                        <div
                          className="data-analytics-factor-bar"
                          style={{ width: "27%" }}
                        ></div>
                        <div className="data-analytics-factor-bar-percent">
                          27%
                        </div>
                      </div>
                    </div>
                    <div className="data-analytics-factor-bar-item">
                      <div className="data-analytics-factor-bar-label">
                        서비스/지원 불만족
                      </div>
                      <div className="data-analytics-factor-bar-container">
                        <div
                          className="data-analytics-factor-bar"
                          style={{ width: "18%" }}
                        ></div>
                        <div className="data-analytics-factor-bar-percent">
                          18%
                        </div>
                      </div>
                    </div>
                    <div className="data-analytics-factor-bar-item">
                      <div className="data-analytics-factor-bar-label">
                        전략적 방향 변경
                      </div>
                      <div className="data-analytics-factor-bar-container">
                        <div
                          className="data-analytics-factor-bar"
                          style={{ width: "12%" }}
                        ></div>
                        <div className="data-analytics-factor-bar-percent">
                          12%
                        </div>
                      </div>
                    </div>
                    <div className="data-analytics-factor-bar-item">
                      <div className="data-analytics-factor-bar-label">
                        기타 사유
                      </div>
                      <div className="data-analytics-factor-bar-container">
                        <div
                          className="data-analytics-factor-bar"
                          style={{ width: "5%" }}
                        ></div>
                        <div className="data-analytics-factor-bar-percent">
                          5%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="data-analytics-insight-box">
                    <div className="data-analytics-insight-icon">💡</div>
                    <div className="data-analytics-insight-content">
                      <strong>AI 인사이트:</strong>
                      <p>
                        이탈 감소를 위해 중소기업 고객군 대상 특별 가격 정책과
                        온보딩 프로세스 개선을 고려해보세요. 최근 3개월간 이
                        세그먼트에서 이탈율이 15% 증가했습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataAnalytics;
