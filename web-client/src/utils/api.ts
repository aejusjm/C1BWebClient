// API 호출 유틸리티 - 인증 헤더 자동 추가
export function getAuthHeaders(): HeadersInit {
  const userInfoStr = localStorage.getItem('userInfo');
  
  if (!userInfoStr) {
    return {
      'Content-Type': 'application/json'
    };
  }

  try {
    const userInfo = JSON.parse(userInfoStr);
    return {
      'Content-Type': 'application/json',
      'x-user-id': userInfo.userId || '',
      'x-user-type': userInfo.userType || ''
    };
  } catch (error) {
    console.error('사용자 정보 파싱 오류:', error);
    return {
      'Content-Type': 'application/json'
    };
  }
}

// 인증이 필요한 fetch 요청
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };

  return fetch(url, {
    ...options,
    headers
  });
}
