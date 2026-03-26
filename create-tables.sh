#!/bin/bash

# Create DynamoDB tables for Recipe Finder authentication

echo "Creating DynamoDB tables for Recipe Finder authentication..."

# Create users table
aws dynamodb create-table \
    --table-name recipe-finder-users \
    --attribute-definitions \
        AttributeName=email,AttributeType=S \
    --key-schema \
        AttributeName=email,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1

echo "Created recipe-finder-users table"

# Create sessions table
aws dynamodb create-table \
    --table-name recipe-finder-sessions \
    --attribute-definitions \
        AttributeName=session_token,AttributeType=S \
    --key-schema \
        AttributeName=session_token,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region us-east-1

echo "Created recipe-finder-sessions table"

# Wait for tables to be active
echo "Waiting for tables to become active..."
aws dynamodb wait table-exists --table-name recipe-finder-users --region us-east-1
aws dynamodb wait table-exists --table-name recipe-finder-sessions --region us-east-1

echo "All tables created successfully!"
echo ""
echo "Tables created:"
echo "- recipe-finder-users (stores user accounts)"
echo "- recipe-finder-sessions (stores login sessions)"
echo ""
echo "Next steps:"
echo "1. Deploy the authentication Lambda function"
echo "2. Update API Gateway to include the /auth endpoint"
echo "3. Update frontend with the correct API endpoint"