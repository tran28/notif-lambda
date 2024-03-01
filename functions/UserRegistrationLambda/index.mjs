// Import necessary AWS SDK components.
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SNSClient, CreateSMSSandboxPhoneNumberCommand } from '@aws-sdk/client-sns';
import { randomBytes, pbkdf2Sync } from 'crypto';
import jwt from 'jsonwebtoken';

// Initialize the DynamoDB Document Client and SNS Client.
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const snsClient = new SNSClient({});

// Specify the DynamoDB table name and JWT secret key.
const tableName = 'UserProducts';
const jwtSecret = '5QGYWAkti8UoLDMzzOvgH_1KDLamwM8gGjRyI71CyYOKL_A02TjmZ5tmu3dfZbyz';

/**
 * Lambda function handler for user registration.
 * 
 * Accepts an event containing a user's email, password, and phone number, checks for an existing user,
 * hashes the password, stores the new user's data in DynamoDB, adds the phone number to verified sandbox
 * destination phone numbers in Amazon SNS, and issues a JWT token if the user does not already exist.
 * 
 * @param {Object} event - The event object containing the request parameters.
 * @returns {Object} The HTTP response object with status code, body, and headers.
 */
export async function handler(event) {
    try {
        const { email, password, phoneNumber } = JSON.parse(event.body);

        // Check for existing user.
        const existingUserCommand = new GetCommand({
            TableName: tableName,
            Key: { PK: `USER#${email}`, SK: 'INFO' }
        });
        const existingUser = await docClient.send(existingUserCommand);
        if (existingUser.Item) {
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

        // Store the new user's data, including phone number, in DynamoDB.
        const putCommand = new PutCommand({
            TableName: tableName,
            Item: {
                PK: `USER#${email}`,
                SK: 'INFO',
                email,
                hashedPassword,
                phoneNumber // Include the phoneNumber in the user's record.
            }
        });
        await docClient.send(putCommand);

        // Add the phone number to verified sandbox destination phone numbers in Amazon SNS.
        const createSMSSandboxPhoneNumberCommand = new CreateSMSSandboxPhoneNumberCommand({
            PhoneNumber: phoneNumber
        });
        await snsClient.send(createSMSSandboxPhoneNumberCommand);

        // Generate JWT token for the newly registered user.
        const token = jwt.sign({ email: email }, jwtSecret, { expiresIn: '1h' });

        // Return successful registration response with JWT token.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "User registered successfully.", token }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            }
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to register user." }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            }
        };
    }
};