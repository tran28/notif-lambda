import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

// Initialize the DynamoDB Document Client for database interactions.
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const tableName = 'UserProducts'; // DynamoDB table name.
const jwtSecret = process.env.JWT_SECRET;

/**
 * Lambda function to authenticate a user via JWT and add a product associated with them.
 * 
 * Validates the JWT token provided in the 'Authorization' header to authenticate the user.
 * Upon successful authentication, it extracts the user's email from the token and associates
 * the new product with that email. Product details are accepted from the request body, and a
 * unique product ID is generated to store alongside these details in DynamoDB.
 * 
 * @param {Object} event - The event object from API Gateway, containing headers and the product details.
 * @returns {Object} - HTTP response object with status code, body including the product ID, and headers.
 */
export async function handler(event) {
    try {
        // Extract JWT token from the Authorization header.
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

        // Extract the user's email from the decoded token.
        const email = decoded.email;

        // Parse the product details from the event body.
        const { name, url, vendor, price, previousPrice } = JSON.parse(event.body);

        // Generate a pseudo-unique ID for the product.
        const productId = randomBytes(16).toString('hex');

        // Prepare and execute a PutCommand to add the product to DynamoDB.
        const putCommand = new PutCommand({
            TableName: tableName,
            Item: {
                PK: `USER#${email}`, // Associate product with the user's email.
                SK: `PRODUCT#${productId}`, // Unique product identifier.
                name, url, vendor, price, previousPrice, productId
            }
        });
        await docClient.send(putCommand);

        // Respond success with the product ID.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Product added successfully.", productId }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            }
        };
    } catch (error) {
        console.error(error); // Log the error for debugging purposes.
        // Return a server error response in case of any exceptions.
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to add product." }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            }
        };
    }
}