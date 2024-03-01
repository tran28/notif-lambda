import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import jwt from 'jsonwebtoken';

// Initialize the DynamoDB Document Client for easier interaction with DynamoDB.
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const tableName = 'UserProducts'; // DynamoDB table name.
const jwtSecret = '5QGYWAkti8UoLDMzzOvgH_1KDLamwM8gGjRyI71CyYOKL_A02TjmZ5tmu3dfZbyz'; // Secret key for JWT verification.

/**
 * Lambda function to authenticate a user via JWT and delete a product.
 * 
 * This function authenticates the user by verifying a JWT token passed in the
 * Authorization header of the request. Upon successful authentication, it deletes
 * a specified product associated with the user's email, which is extracted from the
 * decoded JWT token. The product to be deleted is identified by a `productId`
 * passed as a path parameter.
 * 
 * @param {Object} event - The event object from API Gateway, containing path parameters and headers.
 * @returns {Object} - The HTTP response object with a status code and a message.
 */
export async function handler(event) {
    try {
        // Extract the JWT token from the Authorization header (format: "Bearer <token>").
        const token = event.headers.Authorization?.split(' ')[1];
        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ message: "Authorization token is required." }) };
        }

        // Verify and decode the JWT token.
        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch (error) {
            return { statusCode: 403, body: JSON.stringify({ message: "Invalid or expired token." }) };
        }

        // Extract the user's email from the decoded token and the productId from the path parameters.
        const email = decoded.email;
        const { productId } = event.pathParameters;

        // Delete the specified product for the authenticated user.
        const deleteCommand = new DeleteCommand({
            TableName: tableName,
            Key: { PK: `USER#${email}`, SK: `PRODUCT#${productId}` }
        });
        await docClient.send(deleteCommand);

        // Return a success response after deleting the product.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Product ${productId} from user ${email} deleted successfully.` }),
        };
    } catch (error) {
        console.error(error); // Log the error for debugging purposes.
        // Return a server error response in case of any exceptions.
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to delete product." }),
        };
    }
}