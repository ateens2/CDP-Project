import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os
import torch
import sys

# 명령줄 인수 처리
if len(sys.argv) > 1:
    csv_path = sys.argv[1]
else:
    # 기본 CSV 경로 설정 (명령줄 인수가 없을 경우)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, "고객_구매_기록_더미데이터_확장.csv")

# CPU 모드로 강제 설정
torch.set_num_threads(4)
os.environ['CUDA_VISIBLE_DEVICES'] = ''

# CSV 불러오기
df = pd.read_csv(csv_path)
input_columns = df.columns.tolist()

# 코사인 유사도 임계값 설정
SIMILARITY_THRESHOLD = 0.7

# 제품 판매 기록 시트 필드 정의
sales_fields = [
    "주문_번호", "고객ID", "주문자명", "주문_일자", "거래_완료_일자", 
    "상품명", "단가", "수량", "총_주문_금액", "주문_상태"
]

sales_labels = [
    "주문 번호", "고객 고유 번호", "주문자 이름", "주문 일자", "거래 완료 일자",
    "상품 이름", "상품 단가", "구매 수량", "총 주문 금액", "주문 상태"
]

# 고객 정보 시트 필드 정의
customer_fields = [
    "고객ID", "고객명", "연락처", "이메일", "생년월일", "가입일",
    "마지막_구매일", "총_구매_금액", "총_구매_횟수", "탄소_감축_등급", "탄소_감축_점수"
]

customer_labels = [
    "고객 고유 번호", "고객 이름", "연락처", "이메일 주소", "생년월일", "가입 날짜",
    "마지막 구매 날짜", "총 구매 금액", "총 구매 횟수", "탄소 감축 등급", "탄소 감축 점수"
]

# 제품 판매 기록 룰 기반 매핑
sales_rule_mapping = {
    "주문_번호": ["주문번호", "거래 번호", "Order No.", "주문 ID", "주문 코드", "주문 번호", "order id", "order number"],
    "고객ID": ["고객 ID", "고객번호", "customer id", "customer number", "고객 id", "ID", "id", "고객ID", "customerID", "CustomerId", "Customer ID"],
    "주문자명": ["주문자", "주문자명", "고객명", "구매자", "고객 이름", "구매자명", "customer name", "buyer"],
    "주문_일자": ["주문일", "주문 날짜", "주문일자", "구매일", "거래일", "order date", "purchase date"],
    "거래_완료_일자": ["완료일", "거래완료일", "배송완료일", "처리완료일", "완료날짜", "delivery date", "completion date"],
    "상품명": ["상품명", "제품명", "상품 이름", "제품 이름", "product name", "item name"],
    "단가": ["단가", "가격", "상품가격", "판매가", "price", "unit price"],
    "수량": ["수량", "구매수량", "개수", "qty", "quantity", "구매 수량", "주문 수량"],
    "총_주문_금액": ["총액", "총 금액", "결제금액", "주문금액", "total amount", "order amount"],
    "주문_상태": ["상태", "주문상태", "배송상태", "처리상태", "status", "order status"]
}

# 고객 정보 룰 기반 매핑
customer_rule_mapping = {
    "고객ID": ["고객 ID", "고객번호", "customer id", "customer number", "고객 id", "ID", "id"],
    "고객명": ["고객명", "성명", "이름", "사용자명", "회원명", "customer name", "name"],
    "연락처": ["전화", "휴대폰", "연락처", "핸드폰", "폰번호", "모바일", "phone", "mobile"],
    "이메일": ["이메일", "E-mail", "email", "e-mail", "메일주소", "이메일 주소"],
    "생년월일": ["생년월일", "생일", "birth date", "birthday", "date of birth", "태어난 날", "출생일"],
    "가입일": ["가입일", "등록일", "회원가입", "가입 날짜", "등록일자", "signup date", "registration date"]
}

# 문장 임베딩 모델 로딩
model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
model.to('cpu')

# 배치 크기 설정
BATCH_SIZE = 8

# 입력 필드 벡터화
input_vectors = []
for i in range(0, len(input_columns), BATCH_SIZE):
    batch = input_columns[i:i + BATCH_SIZE]
    batch_vectors = model.encode(batch, show_progress_bar=False)
    input_vectors.extend(batch_vectors)

def find_best_match(input_col, input_vector, rule_mapping, target_labels, target_fields):
    """룰 기반 매핑을 먼저 시도하고, 실패하면 AI 매핑을 수행"""
    
    # 1단계: 룰 기반 매핑
    for field, keywords in rule_mapping.items():
        if any(keyword.lower() in input_col.lower() for keyword in keywords):
            return field, 1.0
    
    # 2단계: AI 임베딩 매핑
    target_vectors = model.encode(target_labels, show_progress_bar=False)
    similarities = cosine_similarity([input_vector], target_vectors)[0]
    best_match_idx = np.argmax(similarities)
    best_score = similarities[best_match_idx]
    
    # 임계값 확인
    if best_score >= SIMILARITY_THRESHOLD:
        return target_fields[best_match_idx], round(float(best_score), 4)
    else:
        return None, round(float(best_score), 4)

def assign_unique_mappings(input_columns, input_vectors, rule_mapping, target_labels, target_fields):
    """중복을 방지하며 최적의 매핑을 수행"""
    mappings = {}
    used_fields = set()
    
    # 1단계: 모든 가능한 매핑 수집
    all_candidates = []
    for i, input_col in enumerate(input_columns):
        matched_field, score = find_best_match(
            input_col, input_vectors[i], rule_mapping, target_labels, target_fields
        )
        if matched_field:
            all_candidates.append((input_col, matched_field, score, i))
    
    # 2단계: 점수 순으로 정렬하여 최고 점수부터 할당
    all_candidates.sort(key=lambda x: x[2], reverse=True)
    
    # 3단계: 중복 없이 할당
    for input_col, matched_field, score, idx in all_candidates:
        if matched_field not in used_fields:
            mappings[input_col] = (matched_field, score)
            used_fields.add(matched_field)
        else:
            mappings[input_col] = (None, score)
    
    # 4단계: 매핑되지 않은 필드들 추가
    for input_col in input_columns:
        if input_col not in mappings:
            mappings[input_col] = (None, 0.0)
    
    return mappings

# 제품 판매 기록 매핑
print("\n📌 제품 판매 기록 시트 매핑 결과:")
print("-" * 50)
sales_mapping = assign_unique_mappings(
    input_columns, input_vectors, sales_rule_mapping, sales_labels, sales_fields
)

for input_col, (matched_field, score) in sales_mapping.items():
    status = "✅ 매핑됨" if matched_field else "❌ 매핑실패"
    print(f"{input_col:20} →  {matched_field or '없음':20} (유사도: {score}) {status}")

print("\n📌 고객 정보 시트 매핑 결과:")
print("-" * 50)
customer_mapping = assign_unique_mappings(
    input_columns, input_vectors, customer_rule_mapping, customer_labels, customer_fields
)

for input_col, (matched_field, score) in customer_mapping.items():
    status = "✅ 매핑됨" if matched_field else "❌ 매핑실패"
    print(f"{input_col:20} →  {matched_field or '없음':20} (유사도: {score}) {status}")

# 최종 매핑 결과 요약
print("\n" + "="*60)
print("📋 최종 매핑 요약")
print("="*60)

print("\n🛒 제품 판매 기록 시트:")
sales_result = {}
for field in sales_fields:
    mapped_from = None
    for input_col, (mapped_field, score) in sales_mapping.items():
        if mapped_field == field:
            mapped_from = input_col
            break
    sales_result[field] = mapped_from
    print(f"  {field:20} ← {mapped_from or '(빈 컬럼)'}")

print("\n👥 고객 정보 시트:")
customer_result = {}
for field in customer_fields:
    mapped_from = None
    for input_col, (mapped_field, score) in customer_mapping.items():
        if mapped_field == field:
            mapped_from = input_col
            break
    customer_result[field] = mapped_from
    # 계산용 필드는 항상 빈 상태로 표시
    if field in ["마지막_구매일", "총_구매_금액", "총_구매_횟수", "탄소_감축_등급", "탄소_감축_점수"]:
        print(f"  {field:20} ← (계산용 빈 컬럼)")
    else:
        print(f"  {field:20} ← {mapped_from or '(빈 컬럼)'}")

# 예외 처리 규칙 안내
print("\n⚠️  예외 처리 규칙:")
if not sales_result.get("거래_완료_일자"):
    print("  - 거래 완료 일자: 주문 일자 + 3일로 자동 계산")
if not sales_result.get("주문_상태"):
    print("  - 주문 상태: '거래 완료'로 기본값 설정")

print(f"\n📊 매핑 통계:")
sales_mapped = sum(1 for field, source in sales_result.items() if source is not None)
customer_mapped = sum(1 for field, source in customer_result.items() 
                     if source is not None and field not in ["마지막_구매일", "총_구매_금액", "총_구매_횟수", "탄소_감축_등급", "탄소_감축_점수"])

print(f"  제품 판매 기록: {sales_mapped}/{len(sales_fields)} 필드 매핑됨")
print(f"  고객 정보: {customer_mapped}/{len(customer_fields)-5} 필드 매핑됨 (5개 계산용 필드 제외)")