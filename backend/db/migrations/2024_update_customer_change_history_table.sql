ALTER TABLE customer_change_history
ADD COLUMN sheet_name VARCHAR(255) AFTER spreadsheet_id,
CHANGE COLUMN customer_email customer_unique_id VARCHAR(255),
ADD INDEX idx_customer_unique_id (customer_unique_id);

-- 기존 action 컬럼은 그대로 사용하고, details 컬럼에 JSON 형태로 변경 전후 값을 저장하는 것이 일반적입니다.
-- 만약 field_name, old_value, new_value 형태를 유지하고 싶다면,
-- 기존 데이터 마이그레이션이 필요할 수 있으나, 현재는 컬럼명 변경에 집중합니다.
-- `action` 컬럼의 의미를 'CREATE', 'UPDATE', 'DELETE' 등으로 명확히 하고,
-- `details` 컬럼에 { fieldName: 'column_name', oldValue: 'old', newValue: 'new' } 형태의 배열을 저장하는 것을 권장합니다.
-- 이번 변경에서는 우선 UniqueID를 사용하도록 수정하는 것에 집중합니다.

-- 참고: 기존 데이터가 있다면 customer_unique_id 컬럼을 어떻게 채울지에 대한 고민이 필요합니다.
-- 현재는 새로 쌓이는 데이터부터 적용됩니다. 