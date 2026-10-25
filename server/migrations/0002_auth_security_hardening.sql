ALTER TABLE user
  MODIFY password VARCHAR(512) NOT NULL;

ALTER TABLE refreshToken
  ADD CONSTRAINT fk_refreshToken_user
    FOREIGN KEY (userId) REFERENCES user(userId) ON DELETE CASCADE;

CREATE UNIQUE INDEX ux_refreshToken_tokenHash
  ON refreshToken (tokenHash);

CREATE INDEX ix_refreshToken_userId_isRevoked
  ON refreshToken (userId, isRevoked);
