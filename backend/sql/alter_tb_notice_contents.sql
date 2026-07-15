-- tb_notice.contents 컬럼 확장 (HTML 공지 내용 저장용)
IF COL_LENGTH('tb_notice', 'contents') IS NOT NULL
BEGIN
  ALTER TABLE tb_notice ALTER COLUMN contents NVARCHAR(MAX) NULL;
END
