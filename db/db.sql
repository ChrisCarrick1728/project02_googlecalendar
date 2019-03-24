CREATE TABLE users (
  id serial primary key,
  username varchar(255) unique,
  password varchar(255)
);

CREATE TABLE googleTokens (
  users_id int references users(id) NOT NULL unique,
  access_token varchar(255),
  refresh_token varchar(255),
  scope varchar(255),
  token_type varchar(50),
  expiry_date varchar(30)
);
