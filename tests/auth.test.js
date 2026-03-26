import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Set env vars BEFORE any imports
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_KEY = 'test-key';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// Mock the DB module
vi.mock('../server/db', () => {
    return {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        pool: { 
            connect: vi.fn().mockResolvedValue({
                query: vi.fn(),
                release: vi.fn()
            })
        }
    };
});

// Import the app AFTER mocking
import { app } from '../server/index.js';

describe('Admin Authentication', () => {
    it('POST /api/admin/login should fail with 401 for invalid creds', async () => {
        const response = await request(app)
            .post('/api/admin/login')
            .send({ email: 'wrong@example.com', password: 'wrong' });
        
        expect(response.status).toBe(401);
    });

    it('GET /api/admin/history should fail with 401 without token', async () => {
        const response = await request(app).get('/api/admin/history');
        expect(response.status).toBe(401);
    });
});

describe('Driver Authentication', () => {
    it('POST /api/driver/login should require identifier and password', async () => {
        const response = await request(app)
            .post('/api/driver/login')
            .send({});
        
        expect(response.status).toBe(400);
    });
});
