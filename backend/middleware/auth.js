// 인증 미들웨어 - API 요청 시 세션 검증
const authMiddleware = (req, res, next) => {
  // 로그인 API는 인증 제외
  if (req.path === '/api/auth/login' || req.path === '/login') {
    return next();
  }

  // 세션에 사용자 정보가 있는지 확인
  const sessionUserId = req.headers['x-user-id'];
  
  if (!sessionUserId) {
    return res.status(401).json({
      success: false,
      message: '인증이 필요합니다. 로그인해주세요.'
    });
  }

  // 요청한 userId와 세션 userId가 일치하는지 확인 (관리자는 제외)
  const requestedUserId = req.params.userId;
  const isAdmin = req.headers['x-user-type'] === 'A';

  if (requestedUserId && requestedUserId !== sessionUserId && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: '권한이 없습니다.'
    });
  }

  next();
};

module.exports = authMiddleware;
