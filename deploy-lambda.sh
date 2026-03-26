#!/bin/bash

# Deploy Recipe Finder Lambda Function

FUNCTION_NAME="recipe-finder"
REGION="us-east-1"
ROLE_NAME="recipe-finder-lambda-role"

echo "📦 Packaging Lambda function..."

# Create deployment package
cd lambda
pip3 install -r requirements.txt -t . --upgrade
zip -r ../recipe-finder.zip . -x "*.pyc" -x "__pycache__/*" -x "*.dist-info/*"
cd ..

echo "🔑 Creating IAM role..."

# Create IAM role if it doesn't exist
aws iam get-role --role-name $ROLE_NAME 2>/dev/null || \
aws iam create-role \
  --role-name $ROLE_NAME \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policies
aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

echo "⏳ Waiting for role to propagate..."
sleep 10

ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)

echo "🚀 Deploying Lambda function..."

# Create or update function
aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null

if [ $? -eq 0 ]; then
  # Update existing function
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://recipe-finder.zip
else
  # Create new function
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime python3.11 \
    --role $ROLE_ARN \
    --handler recipe_finder.lambda_handler \
    --zip-file fileb://recipe-finder.zip \
    --timeout 60 \
    --memory-size 512 \
    --environment Variables={BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0}
fi

echo "✅ Lambda function deployed!"
echo "Function ARN: $(aws lambda get-function --function-name $FUNCTION_NAME --query 'Configuration.FunctionArn' --output text)"

# Clean up
rm recipe-finder.zip

echo ""
echo "Next steps:"
echo "1. Create API Gateway REST API"
echo "2. Add Lambda integration"
echo "3. Enable CORS"
echo "4. Deploy API stage"
