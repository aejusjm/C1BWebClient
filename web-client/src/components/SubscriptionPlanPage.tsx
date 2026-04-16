import './SubscriptionPlanPage.css'
import { useAlert } from '../contexts/AlertContext'

function SubscriptionPlanPage() {
  const { showAlert } = useAlert()

  const handlePaymentClick = async () => {
    await showAlert('준비중입니다')
  }

  return (
    <div className="subscription-plan-page">
      <div className="subscription-header">
        <h1 className="subscription-title">C1B 자동화 서비스 구독 플랜 정보</h1>
      </div>

      <div className="plan-grid">
        <div className="plan-card">
          <div className="plan-badge">기본 플렌</div>
          <div className="plan-price">
            <strong>월 990,000원</strong>
            <span>(VAT 별도)</span>
          </div>
          <div className="plan-divider" />

          <ul className="plan-features">
          <li>상품소싱 일 400 X 3개 사업자 : 매일 1200개(1만개 까지)</li>
            <li>자동 업로드 : 매일 900개 상품</li>
            <li>옵션 및 상세페이지 이미지 자동 번역</li>
            <li>자동 상품갈이 : 매일 150~200개 삭제 후 업로드 자동</li>
            <li>상세페이지 상/하단 이미지 무료 생성(변경 요청 가능)</li>
          </ul>

          <div className="plan-actions">
            <button className="toss-pay-btn" onClick={handlePaymentClick}>
              구독하기
            </button>
          </div>
        </div>

        <div className="plan-card secondary">
          <div className="plan-badge">추가 플랜</div>
          <div className="plan-price">
            <strong>월 50,000원</strong>
            <span>(VAT 별도)</span>
          </div>
          <div className="plan-divider" />

          <ul className="plan-features">
            <li>통관번호 카카오 알림톡 자동 수집 무제한</li>
          </ul>

          <div className="plan-actions">
            <button className="toss-pay-btn" onClick={handlePaymentClick}>
              구독하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionPlanPage
