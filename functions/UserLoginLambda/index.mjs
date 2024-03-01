// Import necessary AWS SDK, cryptographic modules, and jsonwebtoken for JWT generation.
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { randomBytes, pbkdf2Sync } from 'crypto';
import jwt from 'jsonwebtoken';

// Initialize the DynamoDB Document Client for easier interaction with DynamoDB.
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

// Specify the DynamoDB table name and JWT secret key.
const tableName = 'UserProducts';
const jwtSecret = '5QGYWAkti8UoLDMzzOvgH_1KDLamwM8gGjRyI71CyYOKL_A02TjmZ5tmu3dfZbyz';

/**
 * Lambda function handler for user login.
 * 
 * Verifies user credentials against stored records in DynamoDB. Upon successful
 * verification, it issues a JWT token for session management and authentication
 * in subsequent requests.
 * 
 * @param {Object} event - The event object containing the request parameters.
 * @returns {Object} - The HTTP response object with status code, body (including JWT token), and headers.
 */
export async function handler(event) {
    try {
        const { email, password } = JSON.parse(event.body);

        // Retrieve user information from DynamoDB.
        const getUserCommand = new GetCommand({
            TableName: tableName,
            Key: { PK: `USER#${email}`, SK: 'INFO' }
        });
        const { Item } = await docClient.send(getUserCommand);

        // User not found response.
        if (!Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "User not found. Testing speed." }),
                headers: { "Access-Control-Allow-Origin": "*" }
            };
        }

        // Password verification.
        const [algorithm, hashFunction, iterations, salt, hash] = Item.hashedPassword.split(':');
        const derivedHash = pbkdf2Sync(password, salt, parseInt(iterations), 64, hashFunction).toString('hex');
        if (hash !== derivedHash) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Incorrect password." }),
                headers: { "Access-Control-Allow-Origin": "*" }
            };
        }

        // JWT token generation.
        const token = jwt.sign({ email: email }, jwtSecret, { expiresIn: '1h' });

        // Successful login response with JWT token.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Login successful.", token }),
            headers: { "Access-Control-Allow-Origin": "*" }
        };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ message: "Failed to login." }) };
    }
}