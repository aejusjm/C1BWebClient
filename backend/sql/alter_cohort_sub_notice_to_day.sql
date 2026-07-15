-- 기수 구독공지 시작/종료일: DATE → INT(일 1~31) 전환
-- 기존 DATE 값이 있으면 DAY()만 남긴다.

IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'tb_cohort'
      AND COLUMN_NAME = 'sub_notice_start'
      AND DATA_TYPE = 'date'
)
BEGIN
    ALTER TABLE tb_cohort ADD sub_notice_start_day INT NULL;
    ALTER TABLE tb_cohort ADD sub_notice_end_day INT NULL;

    UPDATE tb_cohort
    SET
        sub_notice_start_day = CASE WHEN sub_notice_start IS NULL THEN NULL ELSE DAY(sub_notice_start) END,
        sub_notice_end_day = CASE WHEN sub_notice_end IS NULL THEN NULL ELSE DAY(sub_notice_end) END;

    ALTER TABLE tb_cohort DROP COLUMN sub_notice_start;
    ALTER TABLE tb_cohort DROP COLUMN sub_notice_end;

    EXEC sp_rename 'tb_cohort.sub_notice_start_day', 'sub_notice_start', 'COLUMN';
    EXEC sp_rename 'tb_cohort.sub_notice_end_day', 'sub_notice_end', 'COLUMN';
END
GO
