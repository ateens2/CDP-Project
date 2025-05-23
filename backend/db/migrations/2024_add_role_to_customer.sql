-- customer 테이블에 role 컬럼 추가
ALTER TABLE customer
ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'user' COMMENT 'User role: admin or user';
 
-- ateens8120@gmail.com 사용자를 관리자로 지정
UPDATE customer SET role = 'admin' WHERE email = 'ateens8120@gmail.com'; 