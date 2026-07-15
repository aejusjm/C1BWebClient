-- 기수 구독기준 시작/종료일: DATE → INT(일 1~31) 전환
-- 기존 DATE 값이 있으면 DAY()만 남긴다.

IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'tb_cohort'
      AND COLUMN_NAME = 'sub_base_start'
      AND DATA_TYPE = 'date'
)
BEGIN
    ALTER TABLE tb_cohort ADD sub_base_start_day INT NULL;
    ALTER TABLE tb_cohort ADD sub_base_end_day INT NULL;

    UPDATE tb_cohort
    SET
        sub_base_start_day = CASE WHEN sub_base_start IS NULL THEN NULL ELSE DAY(sub_base_start) END,
        sub_base_end_day = CASE WHEN sub_base_end IS NULL THEN NULL ELSE DAY(sub_base_end) END;

    ALTER TABLE tb_cohort DROP COLUMN sub_base_start;
    ALTER TABLE tb_cohort DROP COLUMN sub_base_end;

    EXEC sp_rename 'tb_cohort.sub_base_start_day', 'sub_base_start', 'COLUMN';
    EXEC sp_rename 'tb_cohort.sub_base_end_day', 'sub_base_end', 'COLUMN';
END
GO
