process.env.NODE_ENV = 'test';
process.env.PORT = '3003';
process.env.DATABASE_URL = 'postgresql://butaca:butaca@127.0.0.1:5432/butaca_test';
process.env.TMDB_API_KEY = 'test-tmdb-key';
process.env.TMDB_BASE_URL = 'https://api.themoviedb.org/3';
process.env.EMOTION_SERVICE_URL = 'http://127.0.0.1:3002';
process.env.SUPABASE_JWT_ISSUER = 'https://test.supabase.co/auth/v1';
process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
process.env.SUPABASE_JWT_SECRET = 'movie-service-test-secret-with-enough-length';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_JWKS_URL;
