const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLite 연결 설정
const dbPath = path.join(__dirname, '../dummy.db');
const db = new sqlite3.Database(dbPath);

// Audit Log 조회
router.get('/', async (req, res) => {
  if (!req.session.user) { // 인증된 사용자인지 먼저 확인
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log('Audit Log 조회 요청 (더미 데이터 사용)');
    
    // 더미 감사 로그 데이터 생성
    const dummyAuditLogs = [
      {
        id: 1,
        timestamp: '2024-06-17T10:30:00.000Z',
        action: 'CREATE',
        resource: 'Customer',
        userId: 'dummy@example.com',
        userName: '홍길동',
        details: '새 고객 생성 - ID: CUST001',
        ipAddress: '127.0.0.1'
      },
      {
        id: 2,
        timestamp: '2024-06-17T11:15:00.000Z',
        action: 'UPDATE',
        resource: 'Product',
        userId: 'dummy@example.com',
        userName: '홍길동',
        details: '상품 정보 수정 - 친환경 세제 가격 변경',
        ipAddress: '127.0.0.1'
      },
      {
        id: 3,
        timestamp: '2024-06-17T12:00:00.000Z',
        action: 'DELETE',
        resource: 'Order',
        userId: 'dummy@example.com',
        userName: '홍길동',
        details: '주문 취소 - 주문번호: ORD000123',
        ipAddress: '127.0.0.1'
      },
      {
        id: 4,
        timestamp: '2024-06-17T13:45:00.000Z',
        action: 'VIEW',
        resource: 'Dashboard',
        userId: 'dummy@example.com',
        userName: '홍길동',
        details: '탄소 영향 대시보드 조회',
        ipAddress: '127.0.0.1'
      },
      {
        id: 5,
        timestamp: '2024-06-17T14:20:00.000Z',
        action: 'EXPORT',
        resource: 'Report',
        userId: 'dummy@example.com',
        userName: '홍길동',
        details: '월간 탄소 감축 리포트 내보내기',
        ipAddress: '127.0.0.1'
      }
    ];
    
    console.log(`더미 감사 로그 ${dummyAuditLogs.length}건 반환`);
    
    res.json({
      success: true,
      auditLogs: dummyAuditLogs,
      total: dummyAuditLogs.length
    });
    
  } catch (error) {
    console.error('Audit Log 조회 중 오류:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch audit logs', 
      error: error.message 
    });
  }
});

// 새 감사 로그 기록
router.post('/', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { action, resource, details } = req.body;
    
    if (!action || !resource) {
      return res.status(400).json({ 
        success: false,
        message: 'Action and resource are required' 
      });
    }
    
    // 더미 감사 로그 기록 (실제로는 SQLite DB에 저장 가능)
    const auditLogEntry = {
      timestamp: new Date().toISOString(),
      action: action,
      resource: resource,
      userId: req.session.user.email,
      userName: req.session.user.name,
      details: details || '',
      ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1'
    };
    
    console.log('새 감사 로그 기록 (더미):', auditLogEntry);
    
    res.json({
      success: true,
      message: 'Audit log recorded successfully',
      auditLog: auditLogEntry
    });
    
  } catch (error) {
    console.error('감사 로그 기록 중 오류:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to record audit log', 
      error: error.message 
    });
  }
});

module.exports = router; 