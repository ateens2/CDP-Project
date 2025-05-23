-- 고객 변경 이력 테이블 생성
CREATE TABLE IF NOT EXISTS customer_change_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_email VARCHAR(255) NOT NULL,
  field_name VARCHAR(64) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by VARCHAR(128) NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_email) REFERENCES customer(email)
);

-- customer 테이블에 created_at, updated_at 컬럼 추가
ALTER TABLE customer ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE customer ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP; 