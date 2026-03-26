#!/bin/bash

# Deploy authentication Lambda function for Recipe Finder

echo "Deploying Recipe Finder authentication Lambda..."

# Create deployment package
cd lambda
zip -r ../recipe-finder-auth.zip user_auth.py

# Update Lambda function (create if doesn't exist)
aws lambda create-function \
    --function-name recipe-finder-auth \
    --runtime python3.12 \
    --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
    --handler user_auth.lambda_handler \
    --zip-file fileb://../recipe-finder-auth.zip \
    --timeout 30 \
    --memory-size 256 \
    --region us-east-1 \
    --environment Variables='{
        "USERS_TABLE":"recipe-finder-users",
        "SESSIONS_TABLE":"recipe-finder-sessions"
    }' 2>/dev/null

# If function already exists, update it
if [ $? -ne 0 ]; then
    echo "Function exists, updating..."
    aws lambda update-function-code \
        --function-name recipe-finder-auth \
        --zip-file fileb://../recipe-finder-auth.zip \
        --region us-east-1
    
    aws lambda update-function-configuration \
        --function-name recipe-finder-auth \
        --timeout 30 \
        --memory-size 256 \
        --environment Variables='{
            "USERS_TABLE":"recipe-finder-users",
            "SESSIONS_TABLE":"recipe-finder-sessions"
        }' \
        --region us-east-1
fi

cd ..

# Clean up
rm recipe-finder-auth.zip

echo "Authentication Lambda deployed successfully!"
echo ""
echo "Function: recipe-finder-auth"
echo "Region: us-east-1"
echo ""
echo "Next steps:"
echo "1. Add API Gateway endpoint for /auth"
echo "2. Update CORS settings"
echo "3. Test the authentication endpoints"