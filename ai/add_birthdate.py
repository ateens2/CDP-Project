#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
고객 구매 기록 CSV 파일에 생년월일 컬럼을 추가하는 스크립트
"""

import pandas as pd
import numpy as np
from datetime import datetime, date
import random

def add_birthdate_column(input_file, output_file):
    """
    CSV 파일에 생년월일 컬럼을 추가하는 함수
    
    Args:
        input_file (str): 입력 CSV 파일 경로
        output_file (str): 출력 CSV 파일 경로
    """
    # CSV 파일 읽기
    print(f"CSV 파일을 읽는 중: {input_file}")
    df = pd.read_csv(input_file)
    
    # 생년월일 범위 설정 (1950-01-01 ~ 2007-12-31)
    start_date = date(1950, 1, 1)
    end_date = date(2007, 12, 31)
    
    # 날짜 범위를 일 단위로 계산
    date_range = (end_date - start_date).days + 1
    
    # uniqueID별로 고유한 생년월일 생성
    unique_customers = df['uniqueID'].unique()
    birthdate_mapping = {}
    
    print(f"고유 고객 수: {len(unique_customers)}")
    print("생년월일 생성 중...")
    
    # 재현 가능한 결과를 위해 시드 설정
    random.seed(42)
    np.random.seed(42)
    
    for customer_id in unique_customers:
        # 랜덤한 일수를 생성하여 시작 날짜에 더함
        random_days = random.randint(0, date_range - 1)
        random_date = start_date + pd.Timedelta(days=random_days)
        birthdate_mapping[customer_id] = random_date.strftime('%Y-%m-%d')
    
    # 데이터프레임에 생년월일 컬럼 매핑
    df['생년월일'] = df['uniqueID'].map(birthdate_mapping)
    
    # 휴대폰번호 컬럼 다음에 생년월일 컬럼을 배치
    columns = df.columns.tolist()
    phone_index = columns.index('휴대폰번호')
    
    # 새로운 컬럼 순서 생성
    new_columns = (columns[:phone_index + 1] + 
                  ['생년월일'] + 
                  columns[phone_index + 1:-1])  # 마지막 '생년월일' 제외
    
    # 컬럼 순서 재정렬
    df = df[new_columns]
    
    # 결과 저장
    print(f"결과를 저장하는 중: {output_file}")
    df.to_csv(output_file, index=False, encoding='utf-8-sig')
    
    # 통계 정보 출력
    print("\n=== 처리 결과 ===")
    print(f"총 레코드 수: {len(df):,}")
    print(f"고유 고객 수: {len(unique_customers):,}")
    print(f"생년월일 범위: {start_date} ~ {end_date}")
    
    # 생년월일 분포 확인 (연도별)
    df['생년'] = pd.to_datetime(df['생년월일']).dt.year
    year_distribution = df['생년'].value_counts().sort_index()
    print(f"\n생년 분포 (처음 10개):")
    print(year_distribution.head(10))
    
    # 샘플 데이터 출력
    print(f"\n처리된 데이터 샘플:")
    sample_columns = ['uniqueID', '고객명', '휴대폰번호', '생년월일']
    if all(col in df.columns for col in sample_columns):
        print(df[sample_columns].head(10).to_string(index=False))
    
    print(f"\n처리 완료! 파일이 저장되었습니다: {output_file}")

if __name__ == "__main__":
    # 파일 경로 설정
    input_file = "고객_구매_기록_더미데이터_확장.csv"
    output_file = "고객_구매_기록_더미데이터_생년월일_추가.csv"
    
    try:
        add_birthdate_column(input_file, output_file)
    except FileNotFoundError:
        print(f"오류: 입력 파일 '{input_file}'을 찾을 수 없습니다.")
        print("스크립트를 CSV 파일과 같은 디렉토리에서 실행해주세요.")
    except Exception as e:
        print(f"오류가 발생했습니다: {str(e)}") 