// Import necessary modules and packages.
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import { pbkdf2Sync } from 'crypto';

// Reuse the PostgreSQL client pool setup for database interactions.
const { Pool } = pkg;
const pool = new Pool({
    user: process.env.RDS_USERNAME,
    host: process.env.RDS_HOST,
    database: process.env.RDS_DATABASE,
    password: process.env.RDS_PASSWORD,
    port: parseInt(process.env.RDS_PORT, 10),
    ssl: {
        rejectUnauthorized: false, // Note: For development/testing only.
    }
});

const jwtSecret = process.env.JWT_SECRET;

/**
 * Lambda function handler for user login.
 *
 * Verifies user credentials against stored records in the PostgreSQL database.
 * Upon successful verification, it issues a JWT token for session management and authentication
 * in subsequent requests.
 *
 * @param {Object} event - The event object containing the request parameters.
 * @returns {Promise<Object>} - The HTTP response object with status code, body (including JWT token), and headers.
 */
export async function handler(event) {
    const client = await pool.connect();
    try {
        const { email, password } = JSON.parse(event.body);

        // Retrieve user information from PostgreSQL.
        const userQuery = 'SELECT email, hashed_password FROM users WHERE email = $1';
        const res = await client.query(userQuery, [email]);
        
        if (res.rows.length === 0) {
            // User not found.
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "User not found." }),
                headers: { "Access-Control-Allow-Origin": "*" }
            };
        }

        const user = res.rows[0];
        const [algorithm, hashFunction, iterations, salt, storedHash] = user.hashed_password.split(':');
        const derivedHash = pbkdf2Sync(password, salt, parseInt(iterations), 64, hashFunction).toString('hex');

        // Password verification.
        if (storedHash !== derivedHash) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Incorrect password." }),
                headers: { "Access-Control-Allow-Origin": "*" }
            };
        }

        // JWT token generation for the verified user.
        const token = jwt.sign({ email }, jwtSecret, { expiresIn: '1h' });

        // Successful login response with JWT token.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Login successful.", token }),
            headers: { "Access-Control-Allow-Origin": "*" }
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to login." }),
            headers: { "Access-Control-Allow-Origin": "*" }
        };
    } finally {
        client.release();
    }
}