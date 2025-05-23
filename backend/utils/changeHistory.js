// mysql 설정 부분은 제거하고 간단한 더미 함수로 대체
async function recordCustomerChangeHistory() {
  // 빈 함수 - 더 이상 DB 테이블을 사용하지 않고 스프레드시트에 직접 기록하는 방식으로 변경됨
  console.log('[RecordChangeHistory] This function is deprecated. Changes are now recorded directly to spreadsheets.');
  return;
}

module.exports = { recordCustomerChangeHistory }; 