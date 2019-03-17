CREATE TABLE users (
  id serial primary key,
  username varchar(255) unique,
  password varchar(255)
);

