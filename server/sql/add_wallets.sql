CREATE TABLE IF NOT EXISTS wallets (
  organization_id BIGINT UNSIGNED NOT NULL,
  balance_usd DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (organization_id)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallet_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  type ENUM('deposit','charge','refund') NOT NULL,
  amount_usd DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  mission_id BIGINT UNSIGNED NULL,
  project_id BIGINT UNSIGNED NULL,
  title VARCHAR(190) NOT NULL DEFAULT '',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY organization_id (organization_id),
  KEY created_at (created_at)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
