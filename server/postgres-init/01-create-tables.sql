CREATE TABLE IF NOT EXISTS domain_user (
    sid VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS domain_group (
    sid VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_groups (
    id INT PRIMARY KEY
    user_id VARCHAR(255) REFERENCES domain_user(sid),
    group_id VARCHAR(255) REFERENCES domain_group(sid)
);