#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
생년월일 일관성 검증 스크립트
"""

import pandas as pd

def verify_birthdate_consistency(filename):
    """생년월일 일관성을 검증하는 함수"""
    df = pd.read_csv(filename)
    
    # 동일한 uniqueID를 가진 고객들의 생년월일이 일치하는지 확인
    check = df.groupby('uniqueID')['생년월일'].nunique()
    inconsistent = check[check > 1]
    
    print(f'총 고객 수: {len(check)}')
    print(f'생년월일이 일치하지 않는 고객 수: {len(inconsistent)}')
    
    if len(inconsistent) == 0:
        print('✅ 모든 고객의 생년월일이 일관성 있게 처리되었습니다!')
    else:
        print('❌ 일부 고객의 생년월일이 일치하지 않습니다.')
        print(inconsistent.head())
    
    # 샘플 고객의 모든 레코드 확인
    sample_customer = df[df['uniqueID'] == 'CUST000001'][['uniqueID', '고객명', '휴대폰번호', '생년월일']]
    print(f'\n샘플 고객 (CUST000001)의 모든 레코드:')
    print(sample_customer)
    
    # 생년월일 분포 확인
    unique_birthdates = df.drop_duplicates(subset=['uniqueID'])[['uniqueID', '생년월일']]
    birth_years = pd.to_datetime(unique_birthdates['생년월일']).dt.year
    year_counts = birth_years.value_counts().sort_index()
    
    print(f'\n생년별 고객 수 분포 (상위 10개):')
    print(year_counts.head(10))
    
    print(f'\n생년월일 범위:')
    print(f'최소: {unique_birthdates["생년월일"].min()}')
    print(f'최대: {unique_birthdates["생년월일"].max()}')

if __name__ == "__main__":
    verify_birthdate_consistency('고객_구매_기록_더미데이터_생년월일_추가.csv') 