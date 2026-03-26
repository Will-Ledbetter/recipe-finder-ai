#!/bin/bash

# Complete Recipe Finder App Deployment Script
# This script deploys Lambda, API Gateway, and S3 frontend

set -e  # Exit on error

FUNCTION_NAME="recipe-finder"
REGION="us-east-1"
ROLE_NAME="recipe-finder-lambda-role"
API_NAME="recipe-finder-api"
BUCKET_NAME="recipe-finder-$(date +%s)"

echo "🚀 Starting Recipe Finder App Deployment..."
echo "================================================"

# Step 1: Deploy Lambda Function
echo ""
echo "📦 Step 1: Packaging Lambda function..."

cd lambda
if [ -f requirements.txt ]; then
  pip3 install -r requirements.txt -t . --upgrade
fi
zip -r ../recipe-finder.zip . -x "*.pyc" -x "__pycache__/*" -x "*.dist-info/*"
cd ..

echo "🔑 Step 2: Creating IAM role..."

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
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess 2>/dev/null || true

echo "⏳ Waiting for role to propagate..."
sleep 10

ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)

echo "🚀 Step 3: Deploying Lambda function..."

# Create or update function
if aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://recipe-finder.zip
  
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout 90 \
    --memory-size 512 \
    --environment Variables={BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0}
else
  echo "Creating new function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime python3.11 \
    --role $ROLE_ARN \
    --handler recipe_finder.lambda_handler \
    --zip-file fileb://recipe-finder.zip \
    --timeout 90 \
    --memory-size 512 \
    --environment Variables={BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0}
fi

LAMBDA_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --query 'Configuration.FunctionArn' --output text)
echo "✅ Lambda deployed: $LAMBDA_ARN"

# Step 4: Create API Gateway
echo ""
echo "🌐 Step 4: Setting up API Gateway..."

# Check if API already exists
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='$API_NAME'].id" --output text)

if [ -z "$API_ID" ]; then
  echo "Creating new API..."
  API_ID=$(aws apigateway create-rest-api \
    --name $API_NAME \
    --description "Recipe Finder API" \
    --endpoint-configuration types=REGIONAL \
    --query 'id' \
    --output text)
else
  echo "Using existing API: $API_ID"
fi

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[?path==`/`].id' \
  --output text)

# Check if /analyze resource exists
RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query "items[?pathPart=='analyze'].id" \
  --output text)

if [ -z "$RESOURCE_ID" ]; then
  echo "Creating /analyze resource..."
  RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_ID \
    --path-part analyze \
    --query 'id' \
    --output text)
fi

# Create POST method
echo "Configuring POST method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE 2>/dev/null || true

# Set Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" 2>/dev/null || true

# Add Lambda permission
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id apigateway-invoke-$(date +%s) \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:*:$API_ID/*/*" 2>/dev/null || true

# Enable CORS
echo "Enabling CORS..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE 2>/dev/null || true

aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers": true, "method.response.header.Access-Control-Allow-Methods": true, "method.response.header.Access-Control-Allow-Origin": true}' 2>/dev/null || true

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}' 2>/dev/null || true

aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'", "method.response.header.Access-Control-Allow-Methods": "'"'"'POST,OPTIONS'"'"'", "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"}' 2>/dev/null || true

# Deploy API
echo "Deploying API to prod stage..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --description "Production deployment $(date)" 2>/dev/null || true

API_ENDPOINT="https://$API_ID.execute-api.$REGION.amazonaws.com/prod/analyze"
echo "✅ API Gateway deployed: $API_ENDPOINT"

# Step 5: Deploy Frontend to S3
echo ""
echo "☁️  Step 5: Deploying frontend to S3..."

# Create S3 bucket
echo "Creating S3 bucket: $BUCKET_NAME"
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Configure bucket for static website hosting
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html \
  --error-document index.html

# Update API endpoint in frontend
echo "Updating API endpoint in frontend..."
sed "s|YOUR_API_GATEWAY_URL_HERE|$API_ENDPOINT|g" frontend/app.js > frontend/app.js.tmp
mv frontend/app.js.tmp frontend/app.js

# Upload frontend files
echo "Uploading frontend files..."
aws s3 sync frontend/ s3://$BUCKET_NAME --acl public-read

# Get website URL
WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

echo ""
echo "================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "📋 Deployment Summary:"
echo "  Lambda Function: $FUNCTION_NAME"
echo "  Lambda ARN: $LAMBDA_ARN"
echo "  API Gateway ID: $API_ID"
echo "  API Endpoint: $API_ENDPOINT"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  Website URL: $WEBSITE_URL"
echo ""
echo "🌐 Access your app at: $WEBSITE_URL"
echo ""
echo "📝 Next Steps:"
echo "  1. Ensure Bedrock model access is enabled (Claude 3 Sonnet)"
echo "  2. Test the application by uploading a fridge image"
echo "  3. (Optional) Set up CloudFront for HTTPS"
echo ""

# Clean up
rm -f recipe-finder.zip

# Save deployment info
cat > deployment-info.txt << EOF
Recipe Finder App - Deployment Information
Generated: $(date)

Lambda Function: $FUNCTION_NAME
Lambda ARN: $LAMBDA_ARN
API Gateway ID: $API_ID
API Endpoint: $API_ENDPOINT
S3 Bucket: $BUCKET_NAME
Website URL: $WEBSITE_URL

To update the Lambda function:
  ./deploy-lambda.sh

To redeploy the API:
  aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod

To update frontend:
  aws s3 sync frontend/ s3://$BUCKET_NAME --acl public-read
EOF

echo "💾 Deployment info saved to: deployment-info.txt"
