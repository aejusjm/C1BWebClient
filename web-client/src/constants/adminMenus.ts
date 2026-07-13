/** 관리자(userType === '관리자')만 접근 가능한 메뉴 */
export const ADMIN_MENUS = [
  // 관리자메뉴
  'standard-info',
  'user-management',
  'notice-management',
  'detail-page-management',
  'deleted-products',
  'batch-log',
  'server-management',
  'banned-words',
  // 관리자통계관리
  'user-sales-stats',
  'daily-sales-stats',
  'mobile-sales-stats',
  'upload-product-stats',
  // 결제관리
  'subscription-management',
  'signup-payment-management',
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
