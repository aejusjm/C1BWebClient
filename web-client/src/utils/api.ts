// API 호출 유틸리티 - 인증 헤더 자동 추가

/** 사용자종류(한글) → HTTP 헤더용 영문 코드 */
const USER_TYPE_HEADER_MAP: Record<string, string> = {
  관리자: 'ADMIN',
  일반: 'NORMAL',
  우대: 'PREFERRED',
  가구매: 'FAKE'
}

function toUserTypeHeader(userType: unknown): string {
  const raw = String(userType ?? '').trim()
  if (!raw) return ''
  if (USER_TYPE_HEADER_MAP[raw]) return USER_TYPE_HEADER_MAP[raw]
  // 이미 영문 코드이거나 ASCII면 그대로
  if (/^[\x00-\x7F]*$/.test(raw)) return raw
  // 알 수 없는 한글 값은 헤더에 넣지 않음 (ISO-8859-1 오류 방지)
  return ''
}

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
      'x-user-id': String(userInfo.userId || '').trim(),
      'x-user-type': toUserTypeHeader(userInfo.userType)
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
