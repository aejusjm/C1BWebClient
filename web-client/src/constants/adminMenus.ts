/** 관리자(userType === '관리자')만 접근 가능한 메뉴 */
export const ADMIN_MENUS = [
  // 관리자메뉴
  'standard-info',
  'user-management',
  'cohort-management',
  'notice-management',
  'detail-page-management',
  'batch-log',
  'server-management',
  'banned-words',
  // 전체상품관리
  'all-products',
  'upload-product-stats',
  'deleted-products',
  // 통계통합관리
  'user-sales-stats',
  'daily-sales-stats',
  'mobile-sales-stats',
  // 구독 및 결제관리
  'subscription-management',
  'signup-payment-management',
  'subscription-settlement',
  'admin-direct-payment',
  // 가구매관리
  'fake-purchase-user',
  'fake-purchase-info',
  'fake-purchase-product',
  'fake-purchase-schedule'
] as const

export type AdminMenu = (typeof ADMIN_MENUS)[number]

export function isAdminUser(userType: string | null | undefined): boolean {
  return String(userType || '').trim() === '관리자'
}

export function isAdminMenu(menu: string | null | undefined): boolean {
  if (!menu) return false
  return (ADMIN_MENUS as readonly string[]).includes(menu)
}
