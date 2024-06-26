// Import necessary modules and packages.
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import { randomBytes, pbkdf2Sync } from 'crypto';
import { SNSClient, CreateSMSSandboxPhoneNumberCommand } from '@aws-sdk/client-sns';
import { readFileSync } from 'fs';
import { join } from 'path';

// Construct the path to the certificate file included in the deployment package
const sslCertPath = join(process.env.LAMBDA_TASK_ROOT || __dirname, 'us-east-1-bundle.pem');
// Read the certificate file
const sslCertContent = readFileSync(sslCertPath);

// Initialize the PostgreSQL client pool for database interactions.
const { Pool } = pkg;
const pool = new Pool({
    user: process.env.RDS_USERNAME,
    host: process.env.RDS_HOST,
    database: process.env.RDS_DATABASE,
    password: process.env.RDS_PASSWORD,
    port: parseInt(process.env.RDS_PORT, 10),
    ssl: {
        rejectUnauthorized: true, // Should always be true in production
        ca: sslCertContent.toString(),
    }
});

// Initialize the Amazon SNS client for notification services.
const snsClient = new SNSClient({ region: "us-east-1" }); // Specify your AWS region

const jwtSecret = process.env.JWT_SECRET;

/**
 * Lambda function handler for user registration.
 * 
 * Processes a user's registration by checking for an existing user with the provided email,
 * securely hashes the password, stores the new user's data in a PostgreSQL database,
 * and issues a JWT token for session management.
 * 
 * @param {Object} event - The event object containing the request parameters.
 * @returns {Promise<Object>} - The HTTP response object with status code, body (including JWT token), and headers.
 */
export async function handler(event) {
    const client = await pool.connect();
    try {
        const { email, password, phoneNumber } = JSON.parse(event.body);

        // Check for an existing user with the provided email.
        const existingUserQuery = 'SELECT email FROM users WHERE email = $1';
        const { rowCount } = await client.query(existingUserQuery, [email]);

        if (rowCount > 0) {
            // User already exists.
            return {
                statusCode: 409,
                body: JSON.stringify({ message: "User already exists." }),
                headers: { "Access-Control-Allow-Origin": "*" }
            };
        }

        // Hash the password for secure storage.
        const salt = randomBytes(16).toString('hex');
        const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        const hashedPassword = `pbkdf2:sha512:1000:${salt}:${hash}`;

        // Store the new user's data in the database.
        const insertUserQuery = 'INSERT INTO users (email, hashed_password, phone_number) VALUES ($1, $2, $3)';
        await client.query(insertUserQuery, [email, hashedPassword, phoneNumber]);

        // Add the phone number to verified sandbox destination phone numbers in Amazon SNS.
        const createSMSSandboxPhoneNumberCommand = new CreateSMSSandboxPhoneNumberCommand({
            PhoneNumber: phoneNumber
        });
        await snsClient.send(createSMSSandboxPhoneNumberCommand);

        // Generate a JWT token for the newly registered user.
        const token = jwt.sign({ email }, jwtSecret, { expiresIn: '1h' });

        // Return successful registration response with JWT token.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "User registered successfully.", token }),
            headers: { "Access-Control-Allow-Origin": "*" }
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to register user." }),
            headers: { "Access-Control-Allow-Origin": "*" }
        };
    } finally {
        client.release();
    }
}