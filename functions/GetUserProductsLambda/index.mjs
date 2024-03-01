import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import jwt from 'jsonwebtoken';

// Initialize the DynamoDB Document Client and define constants.
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const tableName = 'UserProducts'; // DynamoDB table name.
const jwtSecret = '5QGYWAkti8UoLDMzzOvgH_1KDLamwM8gGjRyI71CyYOKL_A02TjmZ5tmu3dfZbyz'; // Secret key for JWT verification.

/**
 * Lambda function to authenticate a user via JWT and retrieve their associated products.
 * 
 * This function authenticates the user by verifying a JWT token provided in the 'Authorization'
 * header. Upon successful authentication, it queries DynamoDB for products associated with the
 * user's email, extracted from the decoded JWT token.
 * 
 * @param {Object} event - The event object from API Gateway, containing headers.
 * @returns {Object} - HTTP response object with status code, body containing products, and headers.
 */
export async function handler(event) {
    try {
        // Extract JWT token from the Authorization header (expected format: "Bearer <token>").
        const token = event.headers.Authorization?.split(' ')[1];
        if (!token) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Authorization token is required." })
            };
        }

        // Attempt to verify and decode the JWT token.
        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch (error) {
            // Handle token verification failures.
            return {
                statusCode: 403,
                body: JSON.stringify({ message: "Invalid or expired token." })
            };
        }

        // Use the decoded email to query the user's products from DynamoDB.
        const email = decoded.email;
        const queryCommand = new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk and begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': `USER#${email}`,
                ':sk': 'PRODUCT#'
            }
        });

        // Execute the query command.
        const { Items } = await docClient.send(queryCommand);

        // Return a success response with the retrieved products.
        return {
            statusCode: 200,
            body: JSON.stringify({ products: Items }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            }
        };
    } catch (error) {
        // Log unexpected errors for troubleshooting.
        console.error(error);
        // Respond with a generic server error message.
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to query products." })
        };
    }
}