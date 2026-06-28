// Тестові env — щоб ENV-валідація (zod) проходила без реального .env (CI).
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET ||= 'test-jwt-secret'
process.env.JWT_EXPIRATION ||= '900'
process.env.REFRESH_JWT_SECRET ||= 'test-refresh-secret'
process.env.REFRESH_JWT_EXPIRATION ||= '2592000'
process.env.PASSWORD_PEPPER ||= 'test-pepper-min-16-characters'
