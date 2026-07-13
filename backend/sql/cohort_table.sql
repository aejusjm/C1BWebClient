-- 기수관리 테이블 (MSSQL)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'tb_cohort' AND xtype = 'U')
BEGIN
    CREATE TABLE tb_cohort (
        seq               INT IDENTITY(1,1) PRIMARY KEY,
        cohort_name       NVARCHAR(100) NOT NULL,           -- 기수명
        ot_date           DATE          NULL,               -- OT일자
        start_date        DATE          NULL,               -- 시작일
        end_date          DATE          NULL,               -- 종료일
        signup_fee        INT           NOT NULL DEFAULT 0, -- 가입비
        sub_base_start    DATE          NULL,               -- 구독기준 시작일
        sub_base_end      DATE          NULL,               -- 구독기준 종료일
        sub_fee           INT           NOT NULL DEFAULT 0, -- 구독료
        sub_notice_start  DATE          NULL,               -- 구독공지 시작일
        sub_notice_end    DATE          NULL,               -- 구독공지 종료일
        created_at        DATETIME      DEFAULT GETDATE(),
        updated_at        DATETIME      NULL
    );

    CREATE INDEX IX_tb_cohort_name ON tb_cohort (cohort_name);
    CREATE INDEX IX_tb_cohort_period ON tb_cohort (start_date, end_date);
END
GO
