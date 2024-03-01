import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Initialize the DynamoDB Document Client for database interactions.
const dynamoDbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);
const tableName = 'UserProducts'; // DynamoDB table name.

/**
 * Lambda function to update the price of a product.
 * 
 * Given a productID, this function updates the "price" field for that product and sets the
 * "previousPrice" to whatever the old "price" field was.
 * 
 * @param {Object} event - The event object from API Gateway, containing the productID and the new price.
 * @returns {Object} - HTTP response object with status code and body including a message.
 */
export async function handler(event) {
    try {
        // Parse the productID and the new price from the event body.
        const { productID, newPrice } = JSON.parse(event.body);

        // Prepare and execute an UpdateCommand to update the product's price in DynamoDB.
        const updateCommand = new UpdateCommand({
            TableName: tableName,
            Key: {
                PK: `PRODUCT#${productID}`,
                SK: `DETAILS`
            },
            UpdateExpression: "set price = :newPrice, previousPrice = price",
            ExpressionAttributeValues: {
                ":newPrice": newPrice
            },
            ReturnValues: "UPDATED_NEW"
        });
        await docClient.send(updateCommand);

        // Respond success with a confirmation message.
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Product price updated successfully." }),
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
            body: JSON.stringify({ message: "Failed to update product price." }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": true
            }
        };
    }
}
