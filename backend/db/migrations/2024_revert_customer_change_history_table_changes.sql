ALTER TABLE customer_change_history
DROP INDEX idx_customer_unique_id,
CHANGE COLUMN customer_unique_id customer_email VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
DROP COLUMN sheet_name;

-- 참고: 원래 customer_email 컬럼에 인덱스가 있었다면 해당 인덱스를 다시 생성해야 할 수 있습니다.
-- 이전 마이그레이션에서 customer_email에 대한 인덱스 변경은 없었으므로, 컬럼명과 타입만 원복합니다. 