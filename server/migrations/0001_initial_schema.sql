CREATE TABLE IF NOT EXISTS users (
    userId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(512) NULL DEFAULT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (userId),
    CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS refreshTokens (
    refreshTokenId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    userId INT UNSIGNED NOT NULL,
    tokenHash VARCHAR(64) NOT NULL,
    isRevoked TINYINT NOT NULL DEFAULT 0,
    expiration TIMESTAMP NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (refreshTokenId),
    CONSTRAINT uq_refreshTokens_tokenHash UNIQUE (tokenHash),

    INDEX ix_refreshTokens_userId_isRevoked (userId, isRevoked),

    CONSTRAINT chk_refreshTokens_isRevoked
        CHECK (isRevoked IN (0, 1)),

    CONSTRAINT fk_refreshTokens_user
        FOREIGN KEY (userId)
        REFERENCES users (userId)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS businesses (
    businessId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (businessId)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS roles (
    roleId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(30) NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (roleId),
    CONSTRAINT uq_roles_name UNIQUE (name)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS businessUsers (
    businessUserId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    businessId INT UNSIGNED NOT NULL,
    userId INT UNSIGNED NOT NULL,
    roleId INT UNSIGNED NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (businessUserId),
    CONSTRAINT uq_businessUsers_businessId_userId
        UNIQUE (businessId, userId),

    INDEX ix_businessUsers_userId (userId),
    INDEX ix_businessUsers_roleId (roleId),

    CONSTRAINT fk_businessUsers_business
        FOREIGN KEY (businessId)
        REFERENCES businesses (businessId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_businessUsers_user
        FOREIGN KEY (userId)
        REFERENCES users (userId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_businessUsers_role
        FOREIGN KEY (roleId)
        REFERENCES roles (roleId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS materials (
    materialId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (materialId),
    CONSTRAINT uq_materials_name UNIQUE (name)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS statuses (
    statusId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(30) NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (statusId),
    CONSTRAINT uq_statuses_name UNIQUE (name)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS stoneTypes (
    stoneTypeId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (stoneTypeId),
    CONSTRAINT uq_stoneTypes_name UNIQUE (name)
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS jewelryItems (
    jewelryItemId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    businessId INT UNSIGNED NOT NULL,
    inventoryNumber VARCHAR(100) NOT NULL,
    styleNumber VARCHAR(100) NOT NULL,
    name VARCHAR(255) NULL DEFAULT NULL,
    description TEXT NULL,
    materialId INT UNSIGNED NOT NULL,
    materialCost DECIMAL(12,2) NULL DEFAULT NULL,
    materialCostCode VARCHAR(50) NULL DEFAULT NULL,
    manufactureYear SMALLINT UNSIGNED NULL DEFAULT NULL,
    manufactureMonth TINYINT UNSIGNED NULL DEFAULT NULL,
    recordedProductionCost DECIMAL(12,2) NULL DEFAULT NULL,
    productionCostCode VARCHAR(50) NULL DEFAULT NULL,
    sellingPrice DECIMAL(12,2) NULL DEFAULT NULL,
    insuranceValue DECIMAL(12,2) NULL DEFAULT NULL,
    statusId INT UNSIGNED NOT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (jewelryItemId),
    CONSTRAINT uq_jewelryItems_businessId_inventoryNumber
        UNIQUE (businessId, inventoryNumber),

    INDEX ix_jewelryItems_businessId_styleNumber
        (businessId, styleNumber),
    INDEX ix_jewelryItems_materialId (materialId),
    INDEX ix_jewelryItems_statusId (statusId),

    CONSTRAINT chk_jewelryItems_materialCost
        CHECK (materialCost IS NULL OR materialCost >= 0),

    CONSTRAINT chk_jewelryItems_recordedProductionCost
        CHECK (
            recordedProductionCost IS NULL
            OR recordedProductionCost >= 0
        ),

    CONSTRAINT chk_jewelryItems_sellingPrice
        CHECK (sellingPrice IS NULL OR sellingPrice >= 0),

    CONSTRAINT chk_jewelryItems_insuranceValue
        CHECK (insuranceValue IS NULL OR insuranceValue >= 0),

    CONSTRAINT chk_jewelryItems_manufactureYear
        CHECK (
            manufactureYear IS NULL
            OR manufactureYear BETWEEN 1 AND 9999
        ),

    CONSTRAINT chk_jewelryItems_manufactureMonth
        CHECK (
            manufactureMonth IS NULL
            OR manufactureMonth BETWEEN 1 AND 12
        ),

    CONSTRAINT chk_jewelryItems_manufactureMonth_requiresYear
        CHECK (
            manufactureMonth IS NULL
            OR manufactureYear IS NOT NULL
        ),

    CONSTRAINT fk_jewelryItems_business
        FOREIGN KEY (businessId)
        REFERENCES businesses (businessId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_jewelryItems_material
        FOREIGN KEY (materialId)
        REFERENCES materials (materialId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_jewelryItems_status
        FOREIGN KEY (statusId)
        REFERENCES statuses (statusId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS jewelryStones (
    jewelryStoneId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    jewelryItemId INT UNSIGNED NOT NULL,
    stoneTypeId INT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NULL DEFAULT NULL,
    totalCarats DECIMAL(10,3) NULL DEFAULT NULL,
    costPerCarat DECIMAL(12,2) NULL DEFAULT NULL,
    costCode VARCHAR(50) NULL DEFAULT NULL,
    sellingPricePerCarat DECIMAL(12,2) NULL DEFAULT NULL,
    sellingPriceCode VARCHAR(50) NULL DEFAULT NULL,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (jewelryStoneId),

    INDEX ix_jewelryStones_jewelryItemId (jewelryItemId),
    INDEX ix_jewelryStones_stoneTypeId (stoneTypeId),

    CONSTRAINT chk_jewelryStones_quantity
        CHECK (quantity IS NULL OR quantity > 0),

    CONSTRAINT chk_jewelryStones_totalCarats
        CHECK (totalCarats IS NULL OR totalCarats > 0),

    CONSTRAINT chk_jewelryStones_costPerCarat
        CHECK (costPerCarat IS NULL OR costPerCarat >= 0),

    CONSTRAINT chk_jewelryStones_sellingPricePerCarat
        CHECK (
            sellingPricePerCarat IS NULL
            OR sellingPricePerCarat >= 0
        ),

    CONSTRAINT fk_jewelryStones_jewelryItem
        FOREIGN KEY (jewelryItemId)
        REFERENCES jewelryItems (jewelryItemId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,

    CONSTRAINT fk_jewelryStones_stoneType
        FOREIGN KEY (stoneTypeId)
        REFERENCES stoneTypes (stoneTypeId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE = InnoDB;


CREATE TABLE IF NOT EXISTS jewelryImages (
    jewelryImageId INT UNSIGNED NOT NULL AUTO_INCREMENT,
    jewelryItemId INT UNSIGNED NOT NULL,
    storageKey VARCHAR(512) NOT NULL,
    sortOrder INT UNSIGNED NOT NULL DEFAULT 0,
    inserted TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (jewelryImageId),

    INDEX ix_jewelryImages_jewelryItemId_sortOrder
        (jewelryItemId, sortOrder),

    CONSTRAINT fk_jewelryImages_jewelryItem
        FOREIGN KEY (jewelryItemId)
        REFERENCES jewelryItems (jewelryItemId)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
) ENGINE = InnoDB;

INSERT INTO roles (name)
VALUES
    ('owner'),
    ('member');

INSERT INTO materials (name)
VALUES
    ('Gold'),
    ('Silver'),
    ('Bronze');

INSERT INTO statuses (name)
VALUES
    ('unknown'),
    ('available'),
    ('sold');

INSERT INTO stoneTypes (name)
VALUES
    ('Diamond'),
    ('Emerald'),
    ('Ruby'),
    ('Sapphire');
