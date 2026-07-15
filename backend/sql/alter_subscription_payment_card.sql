-- tb_subscription_payment / tb_subscription 카드정보 컬럼 추가
IF COL_LENGTH('tb_subscription_payment', 'card_name') IS NULL
    ALTER TABLE tb_subscription_payment ADD card_name NVARCHAR(100) NULL;
GO
IF COL_LENGTH('tb_subscription_payment', 'card_number') IS NULL
    ALTER TABLE tb_subscription_payment ADD card_number NVARCHAR(30) NULL;
GO
IF COL_LENGTH('tb_subscription', 'card_name') IS NULL
    ALTER TABLE tb_subscription ADD card_name NVARCHAR(100) NULL;
GO
IF COL_LENGTH('tb_subscription', 'card_number') IS NULL
    ALTER TABLE tb_subscription ADD card_number NVARCHAR(30) NULL;
GO
