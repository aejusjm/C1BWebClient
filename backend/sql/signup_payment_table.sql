-- C1B 가입 결제(일회성 결제) 테이블 (MSSQL)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_signup_payment' AND xtype = 'U')
BEGIN
    CREATE TABLE tb_signup_payment (
        seq          INT IDENTITY(1,1) PRIMARY KEY,
        joiner_name  NVARCHAR(100) NOT NULL,                 -- 가입자명
        joiner_phone NVARCHAR(50)  NOT NULL,                 -- 연락처
        order_id     NVARCHAR(100) NOT NULL,                 -- 주문번호(고유)
        order_name   NVARCHAR(200) NULL,                     -- 주문명
        payment_key  NVARCHAR(200) NULL,                     -- 토스 결제키
        amount       INT           NOT NULL,                 -- 결제금액(VAT 포함)
        status       NVARCHAR(20)  NOT NULL DEFAULT 'READY', -- READY/DONE/FAILED/CANCELED/PARTIAL_CANCELED
        paid_at      DATETIME      NULL,                     -- 결제완료 일시
        refund_amount INT          NOT NULL DEFAULT 0,       -- 누적 취소금액
        refund_reason NVARCHAR(500) NULL,                    -- 최근 취소 사유
        refunded_at  DATETIME      NULL,                     -- 최근 취소 일시
        raw_response NVARCHAR(MAX) NULL,                     -- 토스 응답 원본
        created_at   DATETIME      DEFAULT GETDATE()
    );

    CREATE UNIQUE INDEX UX_tb_signup_payment_order_id ON tb_signup_payment (order_id);
END
GO

-- 환불 관련 컬럼 (기존 테이블에도 idempotent 적용)
IF COL_LENGTH('tb_signup_payment', 'refund_amount') IS NULL
    ALTER TABLE tb_signup_payment ADD refund_amount INT NOT NULL DEFAULT 0;
GO
IF COL_LENGTH('tb_signup_payment', 'refund_reason') IS NULL
    ALTER TABLE tb_signup_payment ADD refund_reason NVARCHAR(500) NULL;
GO
IF COL_LENGTH('tb_signup_payment', 'refunded_at') IS NULL
    ALTER TABLE tb_signup_payment ADD refunded_at DATETIME NULL;
GO
