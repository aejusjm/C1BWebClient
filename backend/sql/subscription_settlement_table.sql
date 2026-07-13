-- 구독료 정산 테이블 (MSSQL)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_subscription_settlement' AND xtype = 'U')
BEGIN
    CREATE TABLE tb_subscription_settlement (
        seq               INT IDENTITY(1,1) PRIMARY KEY,
        cohort_seq        INT           NULL,                     -- 기수 seq (tb_cohort)
        settle_year       INT           NOT NULL,                 -- 정산년
        settle_month      INT           NOT NULL,                 -- 정산월 (1~12)
        period_start      DATE          NOT NULL,                 -- 정산기간 시작
        period_end        DATE          NOT NULL,                 -- 정산기간 종료
        user_id           NVARCHAR(50)  NOT NULL,
        user_name         NVARCHAR(100) NULL,
        total_sales       BIGINT        NOT NULL DEFAULT 0,       -- 총매출
        subscription_fee  INT           NOT NULL DEFAULT 0,       -- 계산된 구독료
        base_sub_fee      INT           NOT NULL DEFAULT 0,       -- 기준정보 구독료
        refund_amount     INT           NOT NULL DEFAULT 0,       -- 환급금 (base_sub_fee - subscription_fee)
        created_at        DATETIME      DEFAULT GETDATE()
    );

    CREATE INDEX IX_tb_subscription_settlement_ym
      ON tb_subscription_settlement (settle_year, settle_month);

    CREATE INDEX IX_tb_subscription_settlement_period
      ON tb_subscription_settlement (settle_year, settle_month, period_start, period_end);

    CREATE INDEX IX_tb_subscription_settlement_cohort
      ON tb_subscription_settlement (cohort_seq);

    CREATE UNIQUE INDEX UX_tb_subscription_settlement_user_period
      ON tb_subscription_settlement (settle_year, settle_month, period_start, period_end, user_id, cohort_seq);
END
GO

IF COL_LENGTH('tb_subscription_settlement', 'cohort_seq') IS NULL
BEGIN
    ALTER TABLE tb_subscription_settlement ADD cohort_seq INT NULL;
END
GO
