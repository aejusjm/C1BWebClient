-- 구독 결제(토스페이먼츠 빌링) 관련 테이블 생성 스크립트 (MSSQL)

-- 1) 구독/빌링 정보
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_subscription' AND xtype = 'U')
BEGIN
    CREATE TABLE tb_subscription (
        seq           INT IDENTITY(1,1) PRIMARY KEY,
        user_id       NVARCHAR(50)  NOT NULL,                 -- tb_user.user_id
        customer_key  NVARCHAR(100) NOT NULL,                 -- 토스 customerKey (유저별 고유)
        billing_key   NVARCHAR(200) NULL,                     -- 발급된 빌링키 (민감정보)
        plan_type     NVARCHAR(20)  NOT NULL,                 -- 'BASIC' / 'EXTRA'
        amount        INT           NOT NULL,                 -- 실제 청구 금액(원, VAT 포함)
        status        NVARCHAR(20)  NOT NULL DEFAULT 'PENDING',-- PENDING/ACTIVE/CANCELED/FAILED
        next_pay_date DATE          NULL,                     -- 다음 결제 예정일
        created_at    DATETIME      DEFAULT GETDATE(),
        updated_at    DATETIME      DEFAULT GETDATE()
    );

    CREATE UNIQUE INDEX UX_tb_subscription_customer_key ON tb_subscription (customer_key);
    CREATE INDEX IX_tb_subscription_user_id ON tb_subscription (user_id);
END
GO

-- 2) 결제 이력
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_subscription_payment' AND xtype = 'U')
BEGIN
    CREATE TABLE tb_subscription_payment (
        seq          INT IDENTITY(1,1) PRIMARY KEY,
        user_id      NVARCHAR(50)  NOT NULL,
        order_id     NVARCHAR(100) NOT NULL,                  -- 우리가 생성하는 고유 주문번호
        payment_key  NVARCHAR(200) NULL,                      -- 토스 결제키
        plan_type    NVARCHAR(20)  NULL,
        amount       INT           NOT NULL,
        status       NVARCHAR(20)  NOT NULL,                  -- DONE/CANCELED/FAILED
        paid_at      DATETIME      NULL,
        raw_response NVARCHAR(MAX) NULL,                      -- 토스 응답 원본(디버깅용)
        created_at   DATETIME      DEFAULT GETDATE()
    );

    CREATE INDEX IX_tb_subscription_payment_user_id ON tb_subscription_payment (user_id);
    CREATE UNIQUE INDEX UX_tb_subscription_payment_order_id ON tb_subscription_payment (order_id);
END
GO
