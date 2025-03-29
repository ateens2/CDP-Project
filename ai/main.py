import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os
import torch

# CPU 모드로 강제 설정
torch.set_num_threads(4)
os.environ['CUDA_VISIBLE_DEVICES'] = ''

# 현재 스크립트의 디렉토리 경로를 가져옵니다
current_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(current_dir, "더미_고객_데이터_테스트셋.csv")

# 더미 데이터 CSV 불러오기
df = pd.read_csv(csv_path)
input_columns = df.columns.tolist()

# 내부 표준 필드 정의 (영문 필드)
standard_fields = [
    "customer_id", "name", "email", "contact", "signup_date",
    "order_id", "order_date", "order_status", "total_price",
    "payment_method", "shipping_address",
    "product_id", "product_name", "product_category", "product_price", "quantity",
    "inquiry_id", "inquiry_type", "inquiry_create", "inquiry_finish", "inquiry_status"
]

# 각 내부 필드에 대응하는 한글 문장형 라벨
standard_labels = [
    "고객 고유 번호", "고객 이름", "이메일 주소", "연락처", "가입 날짜",
    "주문 고유 번호", "주문 날짜", "주문 상태", "총 결제 금액",
    "결제 방식", "배송지 주소",
    "상품 고유 번호", "상품 이름", "상품 카테고리", "상품 가격", "상품 수량",
    "문의 고유 번호", "문의 유형", "문의 접수일", "문의 처리일", "문의 처리 상태"
]

# 룰 기반 매핑 사전 (각 내부 표준 필드에 해당하는 키워드 목록)
rule_based_mapping = {
    "name": ["고객명", "성명", "이름", "사용자명", "회원명"],
    "email": ["이메일", "E-mail", "email", "메일주소", "이메일 주소"],
    "contact": ["전화", "휴대폰", "연락처", "핸드폰", "폰번호", "모바일"],
    "signup_date": ["가입", "등록일", "회원가입", "가입일", "가입 날짜", "등록일자"],
    "order_id": ["주문번호", "거래 번호", "Order No.", "주문 ID", "주문 코드"],
    "order_date": ["주문일", "결제일", "구매 날짜", "구매일자", "거래일자", "주문일자"],
    "order_status": ["주문 상태", "배송 상태", "상태", "처리상태", "주문 진행", "진행상태"],
    "total_price": ["총액", "결제금액", "주문금액", "구매총액", "총 결제", "결제 금액", "합계"],
    "payment_method": ["결제 수단", "결제 방법", "결제 방식", "Payment", "지불 방식", "결제 유형"],
    "shipping_address": ["주소", "배송 주소", "수령지", "배송지", "받는 주소"],
    "product_id": ["제품 코드", "상품번호", "상품 코드", "제품ID", "SKU", "제품번호"],
    "product_name": ["상품명", "제품명", "상품 이름", "판매 상품", "구매상품"],
    "product_category": ["카테고리", "제품 분류", "분류", "상품종류", "상품 카테고리"],
    "product_price": ["단가", "개당 가격", "상품 가격", "판매가", "가격"],
    "quantity": ["수량", "구매 수량", "주문 수량", "판매 수량", "수량(개)"],
    "inquiry_id": ["문의번호", "상담번호", "이슈번호"],
    "inquiry_type": ["문의 유형", "이슈 유형", "문의 분류", "문의 내용", "이슈 타입"],
    "inquiry_create": ["문의일자", "요청일", "접수일", "문의 날짜", "등록일자"],
    "inquiry_finish": ["처리일자", "완료일", "답변일", "해결일"],
    "inquiry_status": ["진행상태", "처리 상태", "응답상태", "문의 상태", "해결 여부"]
}

# 문장 임베딩 모델 로딩 (다국어 포함)
model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
model.to('cpu')  # 명시적으로 CPU로 이동

# 배치 크기 설정
BATCH_SIZE = 8

# 입력 및 표준 필드 벡터화 (배치 처리)
input_vectors = []
for i in range(0, len(input_columns), BATCH_SIZE):
    batch = input_columns[i:i + BATCH_SIZE]
    batch_vectors = model.encode(batch, show_progress_bar=False)
    input_vectors.extend(batch_vectors)

# 표준 필드(한글 라벨) 벡터화
standard_vectors = []
for i in range(0, len(standard_labels), BATCH_SIZE):
    batch = standard_labels[i:i + BATCH_SIZE]
    batch_vectors = model.encode(batch, show_progress_bar=False)
    standard_vectors.extend(batch_vectors)

# 매핑 수행 (룰 기반 우선 → AI 보조)
mapping_results = {}

for i, input_col in enumerate(input_columns):
    matched = False
    for field, keywords in rule_based_mapping.items():
        if any(keyword in input_col for keyword in keywords):
            mapping_results[input_col] = (field, 1.0)
            matched = True
            break
    if not matched:
        similarities = cosine_similarity([input_vectors[i]], standard_vectors)[0]
        best_match_idx = np.argmax(similarities)
        predicted_field = standard_fields[best_match_idx]  # 내부 필드로 저장
        score = similarities[best_match_idx]
        mapping_results[input_col] = (predicted_field, round(float(score), 4))

# 결과 출력
print("\n📌 필드 매핑 결과:")
print("-" * 40)
for input_col, (predicted, score) in mapping_results.items():
    print(f"{input_col:20} →  {predicted:20} (유사도: {score})")