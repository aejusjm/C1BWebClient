-- tb_user에 기수(seq) 컬럼 추가
IF COL_LENGTH('tb_user', 'cohort_seq') IS NULL
BEGIN
    ALTER TABLE tb_user ADD cohort_seq INT NULL;
END
GO
